import { createDedal, type DedalOptions, type ToPropsInput } from 'dedal'
import type { Contract } from './contract'

/**
 * Instance options:
 * - `defaults` — default props of the design system components,
 * - `toProps.card` — the card gets data in the `data` prop (+ `setupTracking` alongside); other components — data
 *   spread into props (Dedal's default merge).
 */
export const options: DedalOptions<Contract> = {
  defaults: {
    'block-header': { size: 'medium', showDivider: false },
    divider: { thickness: 'medium' },
    card: { size: 'medium', variant: 'vertical', testId: 'article' },
    'image-holder': {
      frameClass: 'C0',
      responsiveData: [
        { breakpoint: 400, frameClass: 'C321' },
        { breakpoint: 768, frameClass: 'C306' },
        { breakpoint: 990, frameClass: 'C321' },
      ],
    },
    ad: { divider: 'both', dontEverHideAd: false, size: 'medium' },
    breadcrumbs: { divider: 'ARROW' },
    footer: { withDivider: true },
    carousel: { length: 4 },
  },
  toProps: {
    card: ({ props, data }: ToPropsInput<Contract, 'card', Record<string, unknown>>) => {
      if (!data) return props
      const { setupTracking, ...rest } = data
      return { ...props, data: rest, ...(setupTracking !== undefined && { setupTracking }) }
    },
  },
}

/**
 * Shared instance: builders (`node`, `repeat`, …) and `resolve` — pure, stateless.
 * Pages and queries are created by `createHomePage()` on its own instance — the instance cache belongs to the data
 * source.
 */
export const ui = createDedal<Contract>(options)

export const createInstance = () => createDedal<Contract>(options)

export const { node, repeat, clone, section } = ui
