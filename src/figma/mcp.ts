/**
 * `dedal-mcp` — an MCP server (stdio) for agents: Figma frame → Dedal template, template validation, the contract as
 * JSON Schema. The tools are thin wrappers over `dedal-figma` and the mapping module — the same conversion, the same
 * report. No dependencies: JSON-RPC 2.0 over newline-delimited stdio, as the MCP stdio transport defines it.
 *
 * ```json
 * { "mcpServers": { "dedal": { "command": "npx", "args": ["dedal-mcp"], "env": { "FIGMA_TOKEN": "…" } } } }
 * ```
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ContractDefinition } from '../contract'
import { contractToJsonSchema } from '../json-schema'
import { validateTemplate } from '../validate'
import { defaultDeps, run, type CliDeps } from './cli'

const PROTOCOL = '2025-06-18'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Request = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }
type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

/** What the server needs from the outside world — replaced in tests. */
export type McpDeps = Partial<CliDeps> & { cwd: string; env: Record<string, string | undefined>; importModule: (path: string) => Promise<Record<string, unknown>> }

const mappingInput = { type: 'string', description: 'Path to the mapping module (its default export is mapping(contract, …) from dedal/figma), relative to the working directory.' }

const tools = [
  {
    name: 'figma_to_template',
    description:
      'Fetch a Figma frame (Figma REST API, FIGMA_TOKEN from the environment), convert it to Dedal templates with the mapping, and validate them against the contract. Returns the report — layers left out with their Figma paths, warnings, validation errors with the template path and the Figma layer — and the templates (JSON, one per top-level layer of the frame), or writes them to `out`. A template that does not match the contract is not written unless `force`.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'A Figma URL with ?node-id=…, or a file key.' },
        node: { type: 'string', description: 'The frame id (1:2 or 1-2), when the URL has no node-id.' },
        mapping: mappingInput,
        out: { type: 'string', description: 'Write the templates to this file instead of returning them.' },
        images: { type: 'string', description: 'Download the images into this directory (e.g. public/figma).' },
        imageUrl: { type: 'string', description: 'How the templates refer to the downloaded images (default: the directory without public/).' },
        force: { type: 'boolean', description: 'Write templates that do not match the contract. Ask the user first.' },
      },
      required: ['url', 'mapping'],
    },
  },
  {
    name: 'validate_template',
    description: 'Validate Dedal templates (an object: section key → block, or one block) against the contract of a mapping module. Returns every problem with its path.',
    inputSchema: {
      type: 'object',
      properties: {
        mapping: mappingInput,
        template: { description: 'The templates as JSON — or a string: a path to a JSON file.' },
      },
      required: ['mapping', 'template'],
    },
  },
  {
    name: 'contract_schema',
    description: 'The contract of a mapping module as JSON Schema: every component, its props (types, allowed values) and its slots — what a template may contain.',
    inputSchema: { type: 'object', properties: { mapping: mappingInput }, required: ['mapping'] },
  },
]

const text = (value: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: value }], ...(isError && { isError }) })

async function contractOf(deps: McpDeps, path: unknown): Promise<ContractDefinition> {
  if (typeof path !== 'string') throw new Error('`mapping` is required: the path to the mapping module')
  const module = await deps.importModule(resolve(deps.cwd, path))
  const contract = (module.default as { contract?: ContractDefinition } | undefined)?.contract
  if (!contract) throw new Error(`${path}: the default export must be a mapping — export default mapping(contract, { … })`)
  return contract
}

async function callTool(name: string, args: Record<string, unknown>, deps: McpDeps): Promise<ToolResult> {
  if (name === 'figma_to_template') {
    const argv = ['pull', String(args.url ?? ''), ...(args.node ? [String(args.node)] : []), '--mapping', String(args.mapping ?? '')]
    for (const [flag, key] of [['--out', 'out'], ['--images', 'images'], ['--image-url', 'imageUrl']] as const) if (typeof args[key] === 'string') argv.push(flag, args[key] as string)
    if (args.force === true) argv.push('--force')
    let stdout = ''
    let stderr = ''
    const code = await run(argv, {
      ...defaultDeps(),
      ...deps,
      stdout: chunk => void (stdout += chunk),
      stderr: chunk => void (stderr += chunk),
    })
    const report = stderr.trim() || 'converted — nothing left out, no warnings'
    return text(stdout ? `${report}\n\nTemplates:\n${stdout}` : report, code !== 0)
  }
  if (name === 'validate_template') {
    const contract = await contractOf(deps, args.mapping)
    const template = typeof args.template === 'string' ? JSON.parse(await readFile(resolve(deps.cwd, args.template), 'utf8')) : args.template
    const isBlock = template && typeof template === 'object' && 'component' in template
    const errors = isBlock
      ? await validateTemplate(contract, template, 'template')
      : template && typeof template === 'object' && !Array.isArray(template)
        ? (await Promise.all(Object.entries(template).map(([key, block]) => validateTemplate(contract, block, key)))).flat()
        : [{ path: 'template', message: 'expected an object: section key → block, or a block' }]
    return errors.length ? text(errors.map(({ path, message }) => `${path}: ${message}`).join('\n'), true) : text('valid — the templates match the contract')
  }
  if (name === 'contract_schema') return text(JSON.stringify(contractToJsonSchema(await contractOf(deps, args.mapping)), null, 2))
  return text(`unknown tool "${name}"`, true)
}

/** Handles one JSON-RPC message; returns the response, or `undefined` for a notification. */
export async function handle(message: Request, deps: McpDeps): Promise<Json | undefined> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id ?? null, result }) as unknown as Json
  const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id: message.id ?? null, error: { code, message: text } }) as Json
  if (message.id === undefined) return undefined // notifications (initialized, cancelled)
  switch (message.method) {
    case 'initialize':
      return reply({
        protocolVersion: typeof message.params?.protocolVersion === 'string' ? message.params.protocolVersion : PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'dedal', version: deps.env.DEDAL_VERSION ?? packageVersion() },
        instructions:
          'Dedal tools: turn a Figma frame into Dedal templates checked against the contract (figma_to_template), validate templates (validate_template), read what a template may contain (contract_schema). Every tool takes the path to the project\'s mapping module.',
      })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools })
    case 'tools/call': {
      const name = String(message.params?.name ?? '')
      try {
        return reply(await callTool(name, (message.params?.arguments as Record<string, unknown>) ?? {}, deps))
      } catch (error) {
        return reply(text((error as Error).message, true))
      }
    }
    default:
      return fail(-32601, `method not found: ${message.method}`)
  }
}

/** The package's version — dist/figma/mcp.js → package.json two levels up. */
function packageVersion(): string {
  try {
    return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version
  } catch {
    return '0'
  }
}

/** Runs the server on stdin / stdout until stdin closes. */
export function serve(): void {
  const deps: McpDeps = { cwd: process.cwd(), env: process.env, importModule: path => import(pathToFileURL(path).href) }
  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => {
    buffer += chunk
    let newline: number
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      let message: Request
      try {
        message = JSON.parse(line)
      } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n')
        continue
      }
      void handle(message, deps).then(response => {
        if (response !== undefined) process.stdout.write(JSON.stringify(response) + '\n')
      })
    }
  })
}
