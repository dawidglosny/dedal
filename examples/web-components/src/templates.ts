import { readFileSync } from 'node:fs'
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

/** Templates stored as JSON: `{ section key: block }`. */
export function loadTemplates(file: URL): Record<string, BlockDefinition<Contract>> {
  const templates = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  for (const [key, block] of Object.entries(templates)) validate(block, key)
  return templates as Record<string, BlockDefinition<Contract>>
}
