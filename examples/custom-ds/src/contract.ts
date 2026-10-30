import type { Slot } from 'dedal'

/**
 * Component contract of a custom design system: layout primitives (`wrapper-container`, `wrapper-layout`,
 * `wrapper-group`), tiles, cards, ads, carousel. Open props (`Props`), slots declared explicitly alongside.
 */
type Props = { [prop: string]: unknown }

export type Contract = {
  'wrapper-container': Props
  'wrapper-layout': Props
  'wrapper-group': Props
  'block-header': Props
  'tile-v2': Props
  'image-holder': Props
  divider: Props
  ad: Props
  card: Props
  /** Carousel: items in the `items` slot list. */
  carousel: Props & { items?: Slot[] }
  /** Content block with an extra component (e.g. an image) in the `secondaryComponent` slot. */
  'special-content': Props & { secondaryComponent?: Slot }
  'home-json-ld': Props
  'home-tracking': Props
  'floating-headers': Props
  'service-header': Props
  breadcrumbs: Props
  footer: Props
}

export type Device = 'desktop' | 'mobile'

/** Page context — serializable (goes into cache keys). */
export type Ctx = { device: Device; url: string }
