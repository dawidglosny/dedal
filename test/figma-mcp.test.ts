/** The dedal-mcp server: JSON-RPC messages in, results out — the real mapping module, the network replaced. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { handle, type McpDeps } from '../src/figma/mcp'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/figma-landing-components.json', import.meta.url), 'utf8'))
const mapping = new URL('./fixtures/figma-components.mapping.ts', import.meta.url).pathname

const files: Record<string, string | Uint8Array> = {}
const deps: McpDeps = {
  cwd: '/project',
  env: { FIGMA_TOKEN: 'figd_test', DEDAL_VERSION: '0.9.0' },
  importModule: path => import(path),
  fetch: async url => ({ ok: true, status: 200, json: async () => (url.endsWith('/images') ? { meta: { images: {} } } : fixture) }),
  writeFile: async (path, content) => void (files[path] = content),
  download: async () => ({ bytes: new Uint8Array(), type: 'image/png' }),
}
const call = (name: string, args: Record<string, unknown>) =>
  handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, deps) as Promise<{ result: { content: { text: string }[]; isError?: boolean } }>

describe('dedal-mcp', () => {
  it('initialize, tools/list, ping; notifications get no response; unknown methods an error', async () => {
    const init = (await handle({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, deps)) as { result: { protocolVersion: string; serverInfo: unknown; capabilities: unknown } }
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'dedal', version: '0.9.0' }, capabilities: { tools: {} } })
    const list = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, deps)) as { result: { tools: { name: string }[] } }
    expect(list.result.tools.map(tool => tool.name)).toEqual(['figma_to_template', 'figma_component_to_contract', 'figma_audit', 'validate_template', 'contract_schema'])
    expect(await handle({ jsonrpc: '2.0', id: 2, method: 'ping' }, deps)).toEqual({ jsonrpc: '2.0', id: 2, result: {} })
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, deps)).toBeUndefined()
    expect(await handle({ jsonrpc: '2.0', id: 3, method: 'resources/list' }, deps)).toMatchObject({ error: { code: -32601 } })
  })

  it('figma_to_template: the report and the templates — the same conversion as the CLI', async () => {
    const { result } = await call('figma_to_template', { url: 'https://www.figma.com/design/AOw4RpmACCpyhHI9YXRJVG/Dedal?node-id=31-398', mapping })
    expect(result.isError).toBeUndefined()
    const [report, templates] = result.content[0]!.text.split('\n\nTemplates:\n')
    expect(report).toContain('Frame 427/Group 12/icon/lock-open')
    expect(Object.keys(JSON.parse(templates!))).toContain('principle')

    const written = await call('figma_to_template', { url: 'AOw4RpmACCpyhHI9YXRJVG', node: '31-398', mapping, out: 'templates/home.json' })
    expect(written.result.content[0]!.text).toContain('✓ 10 section(s) → templates/home.json')
    expect(files['/project/templates/home.json']).toBeDefined()
  })

  it('figma_to_template: a missing token or mapping is an error result, not a crash', async () => {
    const noToken = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'figma_to_template', arguments: { url: 'KEY', node: '1:2', mapping } } }, { ...deps, env: {} })
    expect(noToken).toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('FIGMA_TOKEN is not set') }] } })
  })

  it('figma_component_to_contract: the proposal, read-only', async () => {
    const landing = JSON.parse(readFileSync(new URL('./fixtures/figma-landing.json', import.meta.url), 'utf8'))
    const result = (await handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'figma_component_to_contract', arguments: { url: 'https://www.figma.com/design/KEY/x?node-id=3-136', mapping } } },
      { ...deps, fetch: async () => ({ ok: true, status: 200, json: async () => ({ nodes: { '3:136': landing.nodes['3:136'] } }) }) }
    )) as { result: { content: { text: string }[]; isError?: boolean } }
    expect(result.result.isError).toBeUndefined()
    expect(result.result.content[0]!.text).toContain('Button → button')
    expect(result.result.content[0]!.text).toContain('it matches the design')
  })

  it('validate_template: sections or one block; every problem with its path', async () => {
    expect((await call('validate_template', { mapping, template: { hero: { component: 'badge', props: { label: 'x', variant: 'brand' } } } })).result.content[0]!.text).toBe('valid — the templates match the contract')
    const bad = await call('validate_template', { mapping, template: { component: 'badge', props: { label: 1 } } })
    expect(bad.result.isError).toBe(true)
    expect(bad.result.content[0]!.text).toContain('template.props.label')
  })

  it('contract_schema: components, props and slots as JSON Schema', async () => {
    const schema = JSON.parse((await call('contract_schema', { mapping })).result.content[0]!.text)
    expect(Object.keys(schema.props)).toContain('sectionHeading')
    expect(schema.props.badge.properties.variant.enum).toEqual(['default', 'secondary', 'outline', 'brand', 'accent'])
    expect((await call('contract_schema', { mapping: undefined })).result).toMatchObject({ isError: true })
  })
})
