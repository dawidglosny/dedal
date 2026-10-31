import { createDedal } from 'dedal'
import template from '../templates/home.json'
import { contract } from './contract.mjs'

export const ui = createDedal({ contract })

/**
 * The home page: the sections pulled from the Figma frame (`npm run pull` → templates/home.json), checked against the
 * contract, in the frame's order. No data loaders — everything on this page comes from the design; a page with data
 * would add `data` and bind it with selectors.
 */
export async function homePage() {
  const checked = await ui.validateSections(template)
  if (!checked.ok) throw new Error(`templates/home.json doesn't match the contract:\n${checked.errors.map(e => `  ${e.path}: ${e.message}`).join('\n')}`)
  return ui.page({ sections: Object.entries(checked.value).map(([key, block]) => ui.section(key, block)) })
}
