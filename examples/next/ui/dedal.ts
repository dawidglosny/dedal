import { createDedal, type DedalOptions } from 'dedal'
import type { Contract } from './contract'
import { toProps } from './to-props'

/** Instance options: default props and data-to-props mappings (also used by the docs cases). */
export const options: DedalOptions<Contract> = {
  defaults: {
    card: { size: 'md' },
    grid: { gap: 'md' },
    image: { ratio: '16:9' },
    badge: { variant: 'secondary' },
  },
  toProps,
}

/** One instance per project: contract, default props, mappings and data assignment rules. */
export const ui = createDedal<Contract>(options)

export const { node, repeat, section } = ui
