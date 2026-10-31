/** The dedal-figma CLI with the network and the file system replaced — the real mapping module, the real fixture. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseFigmaUrl, run, type CliDeps } from '../src/figma/cli'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/figma-landing-components.json', import.meta.url), 'utf8'))
const mappingModule = new URL('./fixtures/figma-components.mapping.ts', import.meta.url).pathname

const setup = (overrides: Partial<CliDeps> = {}) => {
  const out = { stdout: '', stderr: '', files: {} as Record<string, string | Uint8Array>, requests: [] as { url: string; token?: string }[], downloads: [] as string[] }
  const deps: CliDeps = {
    env: { FIGMA_TOKEN: 'figd_test' },
    cwd: '/project',
    fetch: async (url, init) => {
      out.requests.push({ url, token: init.headers['X-Figma-Token'] })
      // the images endpoint: every image reference → a (temporary) URL
      const body = url.endsWith('/images') ? { meta: { images: { f36126ad54bf950ebdceaa024f76d6bfdefecb3d: 'https://s3.example/pipeline', missing: null } } } : fixture
      return { ok: true, status: 200, json: async () => body }
    },
    download: async url => (out.downloads.push(url), { bytes: new Uint8Array([137, 80, 78, 71]), type: 'image/png' }),
    importModule: path => import(path),
    writeFile: async (path, content) => void (out.files[path] = content),
    stdout: text => void (out.stdout += text),
    stderr: text => void (out.stderr += text),
    ...overrides,
  }
  return { deps, out }
}

describe('dedal-figma pull', () => {
  it('fetches the node, converts it, writes the templates and reports what was left out', async () => {
    const { deps, out } = setup()
    const code = await run(['pull', 'https://www.figma.com/design/AOw4RpmACCpyhHI9YXRJVG/Dedal?node-id=31-398', '--mapping', mappingModule, '--out', 'templates/home.json'], deps)
    expect(code).toBe(0)
    expect(out.requests).toEqual([{ url: 'https://api.figma.com/v1/files/AOw4RpmACCpyhHI9YXRJVG/nodes?ids=31%3A398', token: 'figd_test' }])
    const sections = JSON.parse(out.files['/project/templates/home.json'] as string)
    expect(Object.keys(sections)).toEqual(['nav', 'hero', 'principle', 'showcase', 'features', 'devtools', 'contract', 'Frame 427', 'cta', 'footer'])
    expect(out.stderr).toContain('1 layer(s) not in the template')
    expect(out.stderr).toContain('Frame 427/Group 12/icon/lock-open')
    expect(out.stderr).toContain('✓ 10 section(s) → templates/home.json')
  })

  it('without --out the templates go to stdout; --raw saves the response', async () => {
    const { deps, out } = setup()
    expect(await run(['pull', 'AOw4RpmACCpyhHI9YXRJVG', '31-398', '--mapping', mappingModule, '--raw', 'raw.json'], deps)).toBe(0)
    expect(Object.keys(JSON.parse(out.stdout))).toContain('hero')
    expect(JSON.parse(out.files['/project/raw.json'] as string).nodes['31:398']).toBeDefined()
  })

  it('--images downloads the images and puts local paths in the templates; without it they stay references', async () => {
    const { deps, out } = setup()
    expect(await run(['pull', 'AOw4RpmACCpyhHI9YXRJVG', '31:398', '--mapping', mappingModule, '--out', 'home.json', '--images', 'public/figma'], deps)).toBe(0)
    expect(out.requests.map(r => r.url)).toContain('https://api.figma.com/v1/files/AOw4RpmACCpyhHI9YXRJVG/images')
    expect(out.downloads).toEqual(['https://s3.example/pipeline'])
    expect(out.files['/project/public/figma/f36126ad54bf950ebdceaa024f76d6bfdefecb3d.png']).toBeInstanceOf(Uint8Array)
    const json = out.files['/project/home.json'] as string
    expect(json).toContain('"src": "/figma/f36126ad54bf950ebdceaa024f76d6bfdefecb3d.png"')
    expect(out.stderr).toMatch(/image .*: Figma returned no URL/) // the other two references got no URL
    expect(json).toContain('figma-image:')

    const without = setup()
    expect(await run(['pull', 'AOw4RpmACCpyhHI9YXRJVG', '31:398', '--mapping', mappingModule], without.deps)).toBe(0)
    expect(without.out.stderr).toContain("image(s) left as figma-image:<ref> — pass --images <dir>")
    expect(without.out.downloads).toEqual([])
  })

  it('templates that don\'t match the contract: errors with the Figma layer, nothing written unless --force', async () => {
    const strict = async () => {
      const { mapping } = await import('../src/figma')
      const { defineContract } = await import('../src')
      const { z } = await import('zod')
      return { default: mapping(defineContract({ navbar: {}, button: { props: z.object({ label: z.number() }) } }), {}) } // a label must be a number
    }
    const { deps, out } = setup({ importModule: strict })
    expect(await run(['pull', 'AOw4RpmACCpyhHI9YXRJVG', '31:398', '--mapping', 'm.js', '--out', 'home.json'], deps)).toBe(1)
    expect(out.stderr).toMatch(/error {2}nav\.children\[0\]\.props\.label \(Figma: nav\/Links\/Button\[0\]\): /)
    expect(out.stderr).toContain('nothing written')
    expect(out.files).toEqual({})
    const forced = setup({ importModule: strict })
    expect(await run(['pull', 'AOw4RpmACCpyhHI9YXRJVG', '31:398', '--mapping', 'm.js', '--out', 'home.json', '--force'], forced.deps)).toBe(1)
    expect(forced.out.files['/project/home.json']).toBeDefined()
  })

  it('a failed request, a missing token, a bad mapping module, wrong usage', async () => {
    const denied = setup({ fetch: async () => ({ ok: false, status: 403, json: async () => ({ status: 403, err: 'Invalid token' }) }) })
    expect(await run(['pull', 'KEY', '1:2', '--mapping', mappingModule], denied.deps)).toBe(1)
    expect(denied.out.stderr).toContain('Figma API: 403 Invalid token')

    const noToken = setup({ env: {} })
    expect(await run(['pull', 'KEY', '1:2', '--mapping', mappingModule], noToken.deps)).toBe(2)
    expect(noToken.out.stderr).toContain('FIGMA_TOKEN is not set')

    const badModule = setup({ importModule: async () => ({ default: {} }) })
    expect(await run(['pull', 'KEY', '1:2', '--mapping', 'm.js'], badModule.deps)).toBe(2)
    expect(badModule.out.stderr).toContain('the default export must be a mapping')

    const missing = setup({ importModule: async () => { throw new Error('Cannot find module /project/nope.js') } })
    expect(await run(['pull', 'KEY', '1:2', '--mapping', 'nope.js'], missing.deps)).toBe(2)
    expect(missing.out.stderr).toContain("nope.js: can't load the mapping module — Cannot find module")

    const offline = setup({ fetch: async () => { throw new Error('getaddrinfo ENOTFOUND api.figma.com') } })
    expect(await run(['pull', 'KEY', '1:2', '--mapping', mappingModule], offline.deps)).toBe(1)
    expect(offline.out.stderr).toContain('the request failed — getaddrinfo ENOTFOUND')

    const usage = setup()
    expect(await run(['pull', 'KEY'], usage.deps)).toBe(2) // no --mapping
    expect(await run(['pull', 'KEY', '--mapping', mappingModule], usage.deps)).toBe(2) // no node
    expect(await run(['push'], usage.deps)).toBe(2)
    expect(usage.out.stderr).toContain('Usage: dedal-figma pull')
  })

  it('Figma URLs: design, file, branches, node ids with dashes', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/ABC/Name?node-id=1-2')).toEqual({ file: 'ABC', node: '1:2' })
    expect(parseFigmaUrl('https://www.figma.com/file/ABC/Name')).toEqual({ file: 'ABC' })
    expect(parseFigmaUrl('https://www.figma.com/design/ABC/branch/BR1/Name?node-id=3-4')).toEqual({ file: 'BR1', node: '3:4' })
    expect(parseFigmaUrl('ABC')).toEqual({ file: 'ABC' })
    expect(() => parseFigmaUrl('https://example.com/x')).toThrow('not a Figma file URL')
  })
})

describe('dedal-figma component / audit', () => {
  const landing = JSON.parse(readFileSync(new URL('./fixtures/figma-landing.json', import.meta.url), 'utf8'))
  const nodesOf = (url: string) => {
    const ids = decodeURIComponent(new URL(url).searchParams.get('ids') ?? '').split(',')
    return { nodes: Object.fromEntries(ids.map(id => [id, landing.nodes[id] ?? null])) }
  }
  // GET /v1/files/:key — a page holding the library's components and icons
  const file = {
    document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [{ id: '2:46', name: 'Components', type: 'CANVAS', children: [
      landing.nodes['3:136'].document, landing.nodes['3:147'].document, landing.nodes['3:148'].document,
      { id: '3:6', name: 'icon/layers', type: 'COMPONENT' }, { id: '3:10', name: 'icon/braces', type: 'COMPONENT' },
      { id: '9:9', name: 'PricingCard', type: 'COMPONENT', componentPropertyDefinitions: { 'Plan#1:0': { type: 'TEXT', defaultValue: 'Pro' } } },
    ] }] },
    components: { ...landing.nodes['3:148'].components, '3:6': { name: 'icon/layers' }, '3:10': { name: 'icon/braces' } },
    componentSets: {},
  }
  const fetch: CliDeps['fetch'] = async url => ({ ok: true, status: 200, json: async () => (url.includes('/nodes?') ? nodesOf(url) : file) })

  it('component: a proposal for an instance\'s main component, with the drift from the contract', async () => {
    const { deps, out } = setup({ fetch })
    // 3:148 is FeatureCard itself; an instance would be resolved to it the same way
    expect(await run(['component', 'https://www.figma.com/design/KEY/x?node-id=3-148', '--mapping', mappingModule], deps)).toBe(0)
    expect(out.stdout).toContain('FeatureCard → feature')
    expect(out.stdout).toContain('Contract entry (defineContract):')
    expect(out.stdout).toContain('The contract already has "feature" — it matches the design.')
    expect(out.stdout).toContain('"icon" is an instance swap')
  })

  it('component: a variant is resolved to its set', async () => {
    const variant = { nodes: { '3:88': { document: { id: '3:88', name: 'variant=outline', type: 'COMPONENT' }, components: { '3:88': { name: 'variant=outline', componentSetId: '3:136' } }, componentSets: { '3:136': { name: 'Button' } } } } }
    const { deps, out } = setup({ fetch: async url => ({ ok: true, status: 200, json: async () => (url.includes('ids=3%3A88') ? variant : nodesOf(url)) }) })
    expect(await run(['component', 'KEY', '3:88'], deps)).toBe(0)
    expect(out.stdout).toContain('Button → button')
  })

  it('audit: matching, drifted, missing — icons skipped as swap targets', async () => {
    const { deps, out } = setup({ fetch })
    const older = async () => {
      const { mapping, component, swap } = await import('../src/figma')
      const { defineContract } = await import('../src')
      const { z } = await import('zod')
      return { default: mapping(defineContract({
        button: { props: z.object({ label: z.string(), variant: z.enum(['default', 'outline']).optional() }) },
        badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary', 'outline', 'brand', 'accent']).optional() }) },
        feature: { props: z.object({ title: z.string(), description: z.string(), icon: z.string().optional() }) },
      }), { feature: component('FeatureCard', { icon: swap('Icon') }) }) }
    }
    deps.importModule = older
    expect(await run(['audit', 'KEY', '--mapping', 'm.mjs'], deps)).toBe(0)
    expect(out.stdout).toContain('4 component(s) in the file (and 2 instance-swap target(s) — icon/… — skipped)')
    expect(out.stdout).toMatch(/matching the contract \(2\):\n  Badge → badge\n  FeatureCard → feature/)
    expect(out.stdout).toContain('Button → button: in the design, not in the contract — prop iconRight; prop size; variant: secondary, ghost, brand')
    expect(out.stdout).toContain('PricingCard (9:9) — no contract component; propose one: dedal-figma component <url>?node-id=9-9')
    expect(await run(['audit', 'KEY'], setup({ fetch }).deps)).toBe(2) // --mapping required
  })
})
