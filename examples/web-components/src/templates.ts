import { readFile } from 'node:fs/promises'
import { ui } from './ui'

/**
 * Templates stored as JSON — `{ section key: block }` — read on every build and checked against the contract: an
 * unknown component, a wrong slot or a prop value the contract doesn't allow fails with its path.
 */
export async function loadTemplates(file: URL) {
  const result = await ui.validateSections(JSON.parse(await readFile(file, 'utf8')))
  if (!result.ok) throw new Error(result.errors.map(({ path, message }) => `${path}: ${message}`).join('\n'))
  return result.value
}
