import { readFile, stat } from 'node:fs/promises'
import type { BlockDefinition } from 'dedal'
import { components, type Contract } from './contract'

const known = new Set<string>(components)

/**
 * Checks a template that comes from outside the code (a file, a database, a design-tool export):
 * the contract is types only, so component names are validated at runtime.
 */
function validate(block: unknown, path: string): asserts block is BlockDefinition<Contract> {
  const { component, slots, children } = (block ?? {}) as { component?: unknown; slots?: Record<string, unknown>; children?: unknown[] }
  if (typeof component !== 'string' || !known.has(component)) throw new Error(`${path}: unknown component ${JSON.stringify(component)}`)
  for (const [name, content] of Object.entries(slots ?? {})) [content].flat().forEach((child, i) => validate(child, `${path}:${name}.${i}`))
  children?.forEach((child, i) => validate(child, `${path}.${i}`))
}

/**
 * Templates stored as JSON: `{ section key: block }`, read on every call — edit the file and the next request uses it.
 * `version` (the file's modification time) goes into the page cache key, so a new version isn't held back by the cache.
 */
export async function loadTemplates(file: URL): Promise<{ version: number; templates: Record<string, BlockDefinition<Contract>> }> {
  const [source, { mtimeMs }] = await Promise.all([readFile(file, 'utf8'), stat(file)])
  const templates = JSON.parse(source) as Record<string, unknown>
  for (const [key, block] of Object.entries(templates)) validate(block, key)
  return { version: mtimeMs, templates: templates as Record<string, BlockDefinition<Contract>> }
}
