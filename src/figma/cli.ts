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
import { contractFromFigma, imageRefs, libraryFromFile, replaceImageRefs, startBridge, templateToFigma, type Bridge, type ComponentProposal, type FigmaConversion, type FigmaNode, type FigmaNodesResponse } from './index'

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
  /** Starts the local bridge to the Dedal Figma plugin (`dedal-figma build`). */
  startBridge?: (options: { port?: number; cwd?: string }) => Promise<Bridge>
}

type Converter = {
  convert(response: FigmaNodesResponse, nodeId: string): Promise<FigmaConversion<unknown>>
  contract: import('../contract').ContractDefinition
  keyFor: (figmaName: string) => string | undefined
  componentName?: (name: string) => string
}

const USAGE = `Usage: dedal-figma pull <file key | Figma URL> [node id] --mapping <module> [--out <file>] [--images <dir>] [--image-url <prefix>] [--raw <file>] [--force]

  <file key | URL>   the Figma file; a URL with ?node-id=… gives the node too
  [node id]          the frame to convert — its top-level layers become sections (1:2 or 1-2)
  --mapping <module> a module whose default export is mapping(contract, …) from dedal/figma
  --out <file>       where to write the templates (JSON); stdout without it
  --images <dir>     download the images (image() in the mapping) into a directory; without it they stay figma-image:<ref>
  --image-url <path> how the template refers to them (default: the directory without a leading public/ — public/figma → /figma)
  --raw <file>       also save the raw REST response (e.g. as a test fixture)
  --force            write the templates even when they don't match the contract

       dedal-figma component <Figma URL of a component, a component set or an instance> [--mapping <module>]
       dedal-figma audit <file key | Figma URL> --mapping <module>
       dedal-figma build <file key | Figma URL> --template <file.json> --mapping <module> [--name <frame>] [--spec <file>] [--force] [--timeout <s>]

  component          propose a contract entry for a Figma component: props, slots, a registry stub, a mapping entry,
                     the questions to answer — and, with --mapping, how it differs from the contract's entry
  audit              every component of the file: mapped to the contract, drifted from it, or missing in the code
  build              build a template as a frame in the Figma file, from its library's components — through the
                     Dedal plugin (figma-plugin/ in the package; open it in Figma desktop); --spec writes the plan only

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

/** The real world: process env and cwd, `fetch`, the file system, the process's streams. */
export const defaultDeps = (): CliDeps => ({
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
  if (!args.flags.help && (command === 'component' || command === 'audit') && target) return inspectComponents(command, target, nodeArg, args.flags, deps)
  if (!args.flags.help && command === 'build' && target) return buildInFigma(target, args.flags, deps)
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

// ---- component / audit: the design system next to the contract

type Flags = Record<string, string | true>

async function figmaGet(deps: CliDeps, token: string, path: string): Promise<{ ok: true; body: any } | { ok: false; message: string }> {
  try {
    const response = await deps.fetch(`https://api.figma.com/v1/${path}`, { headers: { 'X-Figma-Token': token } })
    const body = (await response.json()) as { err?: string }
    return response.ok ? { ok: true, body } : { ok: false, message: `Figma API: ${response.status} ${body.err ?? 'unexpected response'}` }
  } catch (error) {
    return { ok: false, message: `Figma API: the request failed — ${(error as Error).message}` }
  }
}

const formatProposal = (proposal: ComponentProposal) => {
  const lines = [`${proposal.figmaName} → ${proposal.key}`, '', 'Contract entry (defineContract):', proposal.code, '', 'Registry entry to start from:', proposal.registryStub]
  if (proposal.mappingEntry) lines.push('', 'Mapping entry:', proposal.mappingEntry)
  if (proposal.drift) {
    const { key, missingProps, missingValues, missingSlots, extraProps } = proposal.drift
    const changes = [
      ...missingProps.map(prop => `  - prop "${prop}" is in the design, not in the contract`),
      ...Object.entries(missingValues).map(([prop, values]) => `  - "${prop}": values ${values.map(value => `"${value}"`).join(', ')} are in the design, not in the contract`),
      ...missingSlots.map(slot => `  - slot "${slot}" is in the design, not in the contract`),
      ...extraProps.map(prop => `  - prop "${prop}" is in the contract, not in the design (filled by data, or stale?)`),
    ]
    lines.push('', changes.length ? `The contract already has "${key}" — it differs:\n${changes.join('\n')}` : `The contract already has "${key}" — it matches the design.`)
  }
  if (proposal.questions.length) lines.push('', 'Questions before adding it:', ...proposal.questions.map(question => `  - ${question}`))
  return lines.join('\n') + '\n'
}

async function inspectComponents(command: 'component' | 'audit', target: string, nodeArg: string | undefined, flags: Flags, deps: CliDeps): Promise<number> {
  const { stderr } = deps
  let file: string, node: string | undefined
  try {
    ;({ file, node } = parseFigmaUrl(target))
  } catch (error) {
    stderr(`${(error as Error).message}\n`)
    return 2
  }
  node = nodeArg ? nodeArg.replaceAll('-', ':') : node
  const token = deps.env.FIGMA_TOKEN
  if (!token) {
    stderr(`FIGMA_TOKEN is not set — create a personal access token in Figma (Settings → Security) with file content read access\n`)
    return 2
  }
  let converter: Converter | undefined
  if (typeof flags.mapping === 'string') {
    try {
      const module = await deps.importModule(resolve(deps.cwd, flags.mapping))
      converter = (module.default ?? module.fromFigma) as Converter
    } catch (error) {
      stderr(`${flags.mapping}: can't load the mapping module — ${(error as Error).message.split('\n')[0]}\n`)
      return 2
    }
    if (!converter || typeof converter.keyFor !== 'function') {
      stderr(`${flags.mapping}: the default export must be a mapping — export default mapping(contract, { … })\n`)
      return 2
    }
  } else if (command === 'audit') {
    stderr(`--mapping is required for audit\n\n${USAGE}\n`)
    return 2
  }

  if (command === 'component') {
    if (!node) {
      stderr(`a node id is required — the URL of the component (?node-id=…) or an argument\n`)
      return 2
    }
    let got = await figmaGet(deps, token, `files/${encodeURIComponent(file)}/nodes?ids=${encodeURIComponent(node)}`)
    if (!got.ok) return stderr(`${got.message}\n`), 1
    let entry = (got.body as FigmaNodesResponse).nodes[node]
    // an instance or a variant → its main component (the set, for a variant)
    const doc = entry?.document
    const mainId =
      doc?.type === 'INSTANCE' && doc.componentId
        ? (entry!.components[doc.componentId]?.componentSetId ?? doc.componentId)
        : doc?.type === 'COMPONENT' && entry!.components[doc.id]?.componentSetId
          ? entry!.components[doc.id]!.componentSetId
          : undefined
    if (mainId) {
      got = await figmaGet(deps, token, `files/${encodeURIComponent(file)}/nodes?ids=${encodeURIComponent(mainId)}`)
      if (!got.ok) return stderr(`${got.message}\n`), 1
      entry = (got.body as FigmaNodesResponse).nodes[mainId]
      if (!entry) {
        stderr(`the main component of "${doc!.name}" isn't in this file — a component from a library file; open it there and point at it\n`)
        return 1
      }
    }
    if (!entry) return stderr(`figma: node "${node}" is not in the file\n`), 1
    try {
      deps.stdout(formatProposal(contractFromFigma(entry, { ...(converter && { mapping: converter }) })))
    } catch (error) {
      stderr(`${(error as Error).message}\n`)
      return 1
    }
    return 0
  }

  // audit: every component set and standalone component of the file
  const got = await figmaGet(deps, token, `files/${encodeURIComponent(file)}`)
  if (!got.ok) return stderr(`${got.message}\n`), 1
  const body = got.body as { document: FigmaNode; components: FigmaNodesResponse['nodes'][string] extends infer E ? (E extends { components: infer C } ? C : never) : never; componentSets: Record<string, { name: string }> }
  const found: FigmaNode[] = []
  const walk = (current: FigmaNode, inSet: boolean) => {
    if (current.type === 'COMPONENT_SET' || (current.type === 'COMPONENT' && !inSet)) found.push(current)
    for (const child of current.children ?? []) walk(child, inSet || current.type === 'COMPONENT_SET')
  }
  walk(body.document, false)
  // instance-swap targets (icons…) are assets, not blocks: skip the components sharing a swap default's prefix
  const swapPrefixes = new Set<string>()
  for (const component of found) {
    for (const definition of Object.values((component as { componentPropertyDefinitions?: Record<string, { type: string; defaultValue?: unknown }> }).componentPropertyDefinitions ?? {})) {
      const target = definition.type === 'INSTANCE_SWAP' && typeof definition.defaultValue === 'string' ? body.components?.[definition.defaultValue]?.name : undefined
      if (target?.includes('/')) swapPrefixes.add(target.slice(0, target.lastIndexOf('/') + 1))
    }
  }
  const isAsset = (name: string) => [...swapPrefixes].some(prefix => name.startsWith(prefix))
  const assets = found.filter(component => isAsset(component.name)).length
  const rows = { matches: [] as string[], drifted: [] as string[], missing: [] as string[] }
  for (const component of found.filter(component => !isAsset(component.name))) {
    const proposal = contractFromFigma({ document: component, components: body.components ?? {}, componentSets: body.componentSets ?? {} }, { mapping: converter! })
    if (!proposal.drift) rows.missing.push(`  ${component.name} (${component.id}) — no contract component; propose one: dedal-figma component <url>?node-id=${component.id.replace(':', '-')}`)
    else {
      const { missingProps, missingValues, missingSlots } = proposal.drift
      const changes = [...missingProps.map(p => `prop ${p}`), ...Object.entries(missingValues).map(([p, v]) => `${p}: ${v.join(', ')}`), ...missingSlots.map(slot => `slot ${slot}`)]
      if (changes.length) rows.drifted.push(`  ${component.name} → ${proposal.drift.key}: in the design, not in the contract — ${changes.join('; ')}`)
      else rows.matches.push(`  ${component.name} → ${proposal.drift.key}`)
    }
  }
  deps.stdout(
    [
      `${found.length - assets} component(s) in the file${assets ? ` (and ${assets} instance-swap target(s) — ${[...swapPrefixes].join(', ')}… — skipped)` : ''}`,
      `matching the contract (${rows.matches.length}):`,
      ...rows.matches,
      `drifted from the contract (${rows.drifted.length}):`,
      ...rows.drifted,
      `missing in the code (${rows.missing.length}):`,
      ...rows.missing,
    ].join('\n') + '\n'
  )
  return 0
}

// ---- build: a template → a frame in Figma, through the Dedal plugin

async function buildInFigma(target: string, flags: Flags, deps: CliDeps): Promise<number> {
  const { stderr } = deps
  if (typeof flags.template !== 'string' || typeof flags.mapping !== 'string') {
    stderr(`--template and --mapping are required for build\n\n${USAGE}\n`)
    return 2
  }
  let file: string
  try {
    ;({ file } = parseFigmaUrl(target))
  } catch (error) {
    stderr(`${(error as Error).message}\n`)
    return 2
  }
  const token = deps.env.FIGMA_TOKEN
  if (!token) {
    stderr(`FIGMA_TOKEN is not set — create a personal access token in Figma (Settings → Security) with file content read access\n`)
    return 2
  }
  let converter: Converter & Parameters<typeof templateToFigma>[1]['mapping']
  let template: Record<string, unknown>
  try {
    const module = await deps.importModule(resolve(deps.cwd, flags.mapping))
    converter = (module.default ?? module.fromFigma) as typeof converter
    if (!converter || typeof converter.entryFor !== 'function') throw new Error('the default export must be a mapping — export default mapping(contract, { … })')
  } catch (error) {
    stderr(`${flags.mapping}: ${(error as Error).message.split('\n')[0]}\n`)
    return 2
  }
  try {
    template = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(deps.cwd, flags.template), 'utf8'))
  } catch (error) {
    stderr(`${flags.template}: can't read the template — ${(error as Error).message.split('\n')[0]}\n`)
    return 2
  }
  const got = await figmaGet(deps, token, `files/${encodeURIComponent(file)}`)
  if (!got.ok) return stderr(`${got.message}\n`), 1
  const library = libraryFromFile(got.body as { document: FigmaNode })
  const plan = templateToFigma(template, { mapping: converter, library, name: typeof flags.name === 'string' ? flags.name : 'Dedal page' })
  if (plan.unmapped.length) {
    stderr(`${plan.unmapped.length} part(s) of the template have no counterpart in the Figma library:\n`)
    for (const { path, reason } of plan.unmapped) stderr(`  ${path} — ${reason}\n`)
  }
  if (typeof flags.spec === 'string') {
    await deps.writeFile(resolve(deps.cwd, flags.spec), JSON.stringify(plan.spec, null, 2) + '\n')
    stderr(`${plan.ok ? '✓' : '!'} the build plan (${plan.spec.sections.length} section(s)) → ${flags.spec}\n`)
    return plan.ok ? 0 : 1
  }
  if (!plan.ok && !flags.force) {
    stderr(`✗ nothing built — map what's missing, or --force to build the rest\n`)
    return 1
  }
  const bridge = await (deps.startBridge ?? startBridge)({ cwd: deps.cwd })
  const timeout = (Number(flags.timeout) || 300) * 1000
  stderr(`Waiting for the Dedal plugin — in Figma desktop, open the file and run Plugins → Development → Dedal (bridge: ${bridge.url})\n`)
  try {
    const result = await bridge.submit(plan.spec, timeout)
    if (!result) {
      stderr(`✗ no plugin picked the build up in ${timeout / 1000} s — is the Dedal plugin open in Figma? (import figma-plugin/manifest.json once: Plugins → Development → Import plugin from manifest)\n`)
      return 1
    }
    for (const warning of result.warnings) stderr(`warning  ${warning}\n`)
    for (const error of result.errors) stderr(`error  ${error}\n`)
    if (result.ok) stderr(`✓ built "${plan.spec.name}" in Figma — ${result.created} section(s), frame ${result.frameId}\n`)
    return result.ok && plan.ok ? 0 : 1
  } finally {
    await bridge.close()
  }
}
