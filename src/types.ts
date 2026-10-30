/**
 * Base engine types.
 *
 * `C` is the component contract: component name → its props type, e.g.
 * ```ts
 * type Contract = {
 *   card: { size?: 'small' | 'medium' | 'large'; title?: string }
 *   hero: { title?: string; media?: Slot }
 *   tabs: { labels?: string[]; content?: Slot[] }
 * }
 * ```
 * The engine knows no component names — everything comes from `C`.
 */

declare const slotBrand: unique symbol

/** Marks a prop in the contract that is a node (slot). `Slot[]` is a slot list. */
export type Slot = { readonly [slotBrand]: 'slot' }

/** Component names from the contract. */
export type ComponentName<C> = Extract<keyof C, string>

type IsSlot<T> = [NonNullable<T>] extends [Slot | Slot[]] ? ([NonNullable<T>] extends [never] ? false : true) : false

/**
 * Declared keys of a type, without the index signature. For `{ [prop: string]: unknown; media?: Slot }` plain `keyof`
 * gives `string | number` — the signature swallows the literal key `media`.
 */
type KnownKeys<T> = keyof {
  [K in keyof T as string extends K ? never : number extends K ? never : symbol extends K ? never : K]: 0
}

/** Slot names of component `N` (also next to an index signature in the contract). */
export type SlotName<C, N extends ComponentName<C>> = {
  [K in KnownKeys<C[N]>]-?: IsSlot<C[N][K]> extends true ? K : never
}[KnownKeys<C[N]>] &
  string

/** Props of component `N` without slots. */
export type PropsOf<C, N extends ComponentName<C>> = {
  [K in keyof C[N] as IsSlot<C[N][K]> extends true ? never : K]: C[N][K]
}

/** Slot contents of component `N` in the template: a single block or a list of blocks, per the contract. */
export type SlotBlocks<C, N extends ComponentName<C>> = {
  [K in SlotName<C, N>]?: [NonNullable<C[N][K]>] extends [Slot[]] ? BlockDefinition<C>[] : BlockDefinition<C>
}

/** Block fields shared by all components. */
type BlockFields<C> = {
  /** Number of component instances; in the layout each instance becomes a separate sibling. */
  repeat?: number
  /** Name for targeting with the `#alias` selector. */
  alias?: string
  children?: BlockDefinition<C>[]
}

/** Block of a specific component `N`. */
export type BlockOf<C, N extends ComponentName<C>> = {
  component: N
  props?: Partial<PropsOf<C, N>>
  /** A component without slots in the contract does not accept `slots`. */
  slots?: [SlotName<C, N>] extends [never] ? never : SlotBlocks<C, N>
} & BlockFields<C>

/**
 * Raw block definition (template). Describes structure only — no IDs and no data.
 * A union over all components, so `props` and `slots` are typed by `component`.
 */
export type BlockDefinition<C, N extends ComponentName<C> = ComponentName<C>> = N extends ComponentName<C>
  ? BlockOf<C, N>
  : never

/**
 * Where a prop comes from: component defaults, template, patch (which selector, which section), data —
 * or `layout` when the layout was built without `trace` (source within the layout unknown).
 */
export type PropSource =
  | { from: 'default' }
  | { from: 'template' }
  | { from: 'patch'; selector: string; section?: string }
  | { from: 'layout' }
  | { from: 'data' }

/**
 * Layout node: has a unique ID, `repeat` is expanded into siblings, `props` are always present.
 * The layout is a tree — the renderer walks it recursively (slots, then children).
 */
export type LayoutNode<C, N extends ComponentName<C> = ComponentName<C>> = N extends ComponentName<C>
  ? {
      id: string
      component: N
      props: Partial<PropsOf<C, N>>
      alias?: string
      slots?: Record<string, LayoutNode<C> | LayoutNode<C>[]>
      children?: LayoutNode<C>[]
      /** Props origin (top-level keys) — only with `trace: true`. */
      trace?: Record<string, PropSource>
    }
  : never

/** Type of nodes returned by `select()`: narrowed when the selector is a bare component name. */
export type Selected<C, S extends string> = S extends ComponentName<C> ? LayoutNode<C, S> : LayoutNode<C>

/** Default component props, applied by `node()`. */
export type ComponentDefaults<C> = { [N in ComponentName<C>]?: Partial<PropsOf<C, N>> }

/** Node position segment: child index or slot (with an index for a slot list). */
export type PathSegment = number | { slot: string; index?: number }
