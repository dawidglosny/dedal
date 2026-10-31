/**
 * `dedal-figma` — fetches a frame from the Figma REST API, converts it with a mapping and writes the templates.
 *
 * ```sh
 * FIGMA_TOKEN=… dedal-figma pull https://www.figma.com/design/AOw4…/Landing?node-id=31-398 --mapping ./figma.mapping.js --out templates/home.json
 * ```
 */
import { mkdir, writeFile as fsWriteFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { imageRefs, replaceImageRefs, type FigmaConversion, type FigmaNodesResponse } from './index'

/** What `run` needs from the outside world — replaced in tests. */
export type CliDeps = {
  env: Record<string, string | undefined>
  cwd: string
  fetch: (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>
  importModule: (path: string) => Promise<Record<string, unknown>>
  writeFile: (path: string, content: string | Uint8Array) => Promise<void>
  /** Downloads a file (an image from Figma's storage): its bytes and content type. */
  download: (url: string) => Promise<{ bytes: Uint8Array; type: string }>
  stdout: (text: string) => void
  stderr: (text: string) => void
}

type Converter = { convert(response: FigmaNodesResponse, nodeId: string): Promise<FigmaConversion<unknown>> }

const USAGE = `Usage: dedal-figma pull <file key | Figma URL> [node id] --mapping <module> [--out <file>] [--images <dir>] [--image-url <prefix>] [--raw <file>] [--force]

  <file key | URL>   the Figma file; a URL with ?node-id=… gives the node too
  [node id]          the frame to convert — its top-level layers become sections (1:2 or 1-2)
  --mapping <module> a module whose default export is mapping(contract, …) from dedal/figma
  --out <file>       where to write the templates (JSON); stdout without it
  --images <dir>     download the images (image() in the mapping) into a directory; without it they stay figma-image:<ref>
  --image-url <path> how the template refers to them (default: the directory without a leading public/ — public/figma → /figma)
  --raw <file>       also save the raw REST response (e.g. as a test fixture)
  --force            write the templates even when they don't match the contract

The token is read from FIGMA_TOKEN (a personal access token with file content read access).`

/** A file key and an optional node id from a Figma URL (`/design/:key/…?node-id=1-2`, `/file/…`, branches). */
export function parseFigmaUrl(input: string): { file: string; node?: string } {
  if (!/^https?:\/\//.test(input)) return { file: input }
  const url = new URL(input)
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.findIndex(part => part === 'design' || part === 'file' || part === 'proto')
  if (at === -1 || !parts[at + 1]) throw new Error(`not a Figma file URL: ${input}`)
  const branch = parts[at + 2] === 'branch' ? parts[at + 3] : undefined
  const node = url.searchParams.get('node-id') ?? undefined
  return { file: branch ?? parts[at + 1]!, ...(node && { node: node.replaceAll('-', ':') }) }
}

const parseArgs = (argv: string[]) => {
  const positional: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (!arg.startsWith('--')) positional.push(arg)
    else if (arg === '--force' || arg === '--help') flags[arg.slice(2)] = true
    else {
      const value = argv[++i]
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`)
      flags[arg.slice(2)] = value
    }
  }
  return { positional, flags }
}

const defaultDeps = (): CliDeps => ({
  env: process.env,
  cwd: process.cwd(),
  fetch: (url, init) => fetch(url, init),
  importModule: path => import(pathToFileURL(path).href),
  writeFile: async (path, content) => {
    await mkdir(dirname(path), { recursive: true })
    await fsWriteFile(path, content)
  },
  download: async url => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} for ${url}`)
    return { bytes: new Uint8Array(await response.arrayBuffer()), type: response.headers.get('content-type') ?? '' }
  },
  stdout: text => process.stdout.write(text),
  stderr: text => process.stderr.write(text),
})

/** Runs the CLI; returns the exit code (0 ok, 1 a failed conversion or request, 2 wrong usage). */
export async function run(argv: string[], deps: CliDeps = defaultDeps()): Promise<number> {
  const { stderr } = deps
  let args: ReturnType<typeof parseArgs>
  try {
    args = parseArgs(argv)
  } catch (error) {
    stderr(`${(error as Error).message}\n\n${USAGE}\n`)
    return 2
  }
  const [command, target, nodeArg] = args.positional
  if (args.flags.help || command !== 'pull' || !target) {
    stderr(`${USAGE}\n`)
    return args.flags.help ? 0 : 2
  }
  const mappingPath = args.flags.mapping
  if (typeof mappingPath !== 'string') {
    stderr(`--mapping is required\n\n${USAGE}\n`)
    return 2
  }
  let file: string, node: string | undefined
  try {
    ;({ file, node } = parseFigmaUrl(target))
  } catch (error) {
    stderr(`${(error as Error).message}\n`)
    return 2
  }
  node = nodeArg ? nodeArg.replaceAll('-', ':') : node
  if (!node) {
    stderr(`a node id is required — as an argument, or ?node-id=… in the URL\n`)
    return 2
  }
  const token = deps.env.FIGMA_TOKEN
  if (!token) {
    stderr(`FIGMA_TOKEN is not set — create a personal access token in Figma (Settings → Security) with file content read access\n`)
    return 2
  }

  let module: Record<string, unknown>
  try {
    module = await deps.importModule(resolve(deps.cwd, mappingPath))
  } catch (error) {
    stderr(`${mappingPath}: can't load the mapping module — ${(error as Error).message.split('\n')[0]}\n`)
    return 2
  }
  const converter = (module.default ?? module.fromFigma) as Converter | undefined
  if (!converter || typeof converter.convert !== 'function') {
    stderr(`${mappingPath}: the default export must be a mapping — export default mapping(contract, { … })\n`)
    return 2
  }

  let response: Awaited<ReturnType<CliDeps['fetch']>>, body: FigmaNodesResponse & { err?: string; status?: number }
  try {
    response = await deps.fetch(`https://api.figma.com/v1/files/${encodeURIComponent(file)}/nodes?ids=${encodeURIComponent(node)}`, {
      headers: { 'X-Figma-Token': token },
    })
    body = (await response.json()) as typeof body
  } catch (error) {
    stderr(`Figma API: the request failed — ${(error as Error).message}\n`)
    return 1
  }
  if (!response.ok || !body.nodes) {
    stderr(`Figma API: ${response.status} ${body.err ?? 'unexpected response'}\n`)
    return 1
  }
  if (typeof args.flags.raw === 'string') await deps.writeFile(resolve(deps.cwd, args.flags.raw), JSON.stringify(body, null, 1) + '\n')

  const result = await converter.convert(body, node)
  const count = Object.keys(result.sections).length
  for (const { path, message } of result.warnings) stderr(`warning  ${path}: ${message}\n`)
  if (result.unmapped.length) {
    stderr(`${result.unmapped.length} layer(s) not in the template:\n`)
    for (const { path, reason } of result.unmapped) stderr(`  ${path} — ${reason}\n`)
  }
  if (!result.ok) {
    for (const { path, figma, message } of result.errors) stderr(`error  ${path}${figma ? ` (Figma: ${figma})` : ''}: ${message}\n`)
    if (!args.flags.force) {
      stderr(`✗ ${result.errors.length} error(s) — nothing written (--force writes anyway)\n`)
      return 1
    }
  }

  // images: Figma gives their URLs through another request, and the URLs expire — download them with the templates
  let sections: unknown = result.sections
  const refs = [...imageRefs(sections)]
  if (refs.length && typeof args.flags.images === 'string') {
    const dir = args.flags.images
    const prefix = typeof args.flags['image-url'] === 'string' ? args.flags['image-url'] : `/${dir.replace(/^(\.\/)?public\//, '').replace(/^\/+/, '')}`
    let urls: Record<string, string | null>
    try {
      const images = await deps.fetch(`https://api.figma.com/v1/files/${encodeURIComponent(file)}/images`, { headers: { 'X-Figma-Token': token } })
      urls = ((await images.json()) as { meta?: { images?: Record<string, string | null> } }).meta?.images ?? {}
    } catch (error) {
      stderr(`Figma API: the image request failed — ${(error as Error).message}\n`)
      return 1
    }
    const paths: Record<string, string> = {}
    for (const ref of refs) {
      const url = urls[ref]
      if (!url) {
        stderr(`warning  image ${ref}: Figma returned no URL — left as figma-image:${ref}\n`)
        continue
      }
      try {
        const { bytes, type } = await deps.download(url)
        const ext = /svg/.test(type) ? 'svg' : /jpe?g/.test(type) ? 'jpg' : /gif/.test(type) ? 'gif' : /webp/.test(type) ? 'webp' : 'png'
        await deps.writeFile(resolve(deps.cwd, dir, `${ref}.${ext}`), bytes)
        paths[ref] = `${prefix.replace(/\/+$/, '')}/${ref}.${ext}`
      } catch (error) {
        stderr(`warning  image ${ref}: download failed (${(error as Error).message}) — left as figma-image:${ref}\n`)
      }
    }
    sections = replaceImageRefs(sections, paths)
    stderr(`${Object.keys(paths).length} image(s) → ${dir}\n`)
  } else if (refs.length) stderr(`warning  ${refs.length} image(s) left as figma-image:<ref> — pass --images <dir> to download them\n`)

  const json = JSON.stringify(sections, null, 2) + '\n'
  if (typeof args.flags.out === 'string') {
    await deps.writeFile(resolve(deps.cwd, args.flags.out), json)
    stderr(`${result.ok ? '✓' : '!'} ${count} section(s) → ${args.flags.out}\n`)
  } else deps.stdout(json)
  return result.ok ? 0 : 1
}
