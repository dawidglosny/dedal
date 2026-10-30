import type { BlockDefinition, ComponentDefaults, LayoutNode, PathSegment, PropSource } from './types'

/** Context passed to the ID generator. */
export type IdContext = {
  /** Section prefix passed to `layout()`. */
  prefix: string
  /** Node position from the root (root = `[]`). */
  path: readonly PathSegment[]
  /** Parent ID (none for the root). */
  parentId?: string
  component: string
  alias?: string
}

/** A custom node ID generator. IDs must be unique across the page — start them with the section key, like the default one. */
export type IdGenerator = (ctx: IdContext) => string

/** Options of `layout()`: the ID generator, `trace` and the defaults used to tell `default` from `template` props. */
export type LayoutOptions = {
  /** ID generator. Default: `news`, `news.0.2`, `news.0:media`, `news.1:content.0`. */
  id?: IdGenerator
  /** Records props origin in `node.trace` (`default` / `template`) — debug mode. */
  trace?: boolean
  /** Default component props — with `trace` they distinguish `default` from `template`. */
  defaults?: ComponentDefaults<unknown>
}

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** A prop equal to the component default = `default` (`node()` merges them with block props, so we reconstruct the source). */
const traceOf = (component: string, props: Record<string, unknown>, defaults: ComponentDefaults<unknown> = {}) => {
  const componentDefaults = (defaults as Record<string, Record<string, unknown> | undefined>)[component] ?? {}

  return Object.fromEntries(
    Object.keys(props).map(key => [
      key,
      (Object.hasOwn(componentDefaults, key) && sameValue(componentDefaults[key], props[key])
        ? { from: 'default' }
        : { from: 'template' }) satisfies PropSource,
    ])
  )
}

const defaultId: IdGenerator = ({ prefix, path, parentId }) => {
  const last = path[path.length - 1]

  if (last === undefined) return prefix
  if (typeof last === 'number') return `${parentId}.${last}`

  return last.index === undefined ? `${parentId}:${last.slot}` : `${parentId}:${last.slot}.${last.index}`
}

const instancesOf = (block: { component: string; repeat?: number }) => {
  const { repeat = 1 } = block

  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new RangeError(`layout: repeat in "${block.component}" must be an integer >= 1, got ${repeat}`)
  }

  return repeat
}

const expand = <C>(blocks: BlockDefinition<C>[]) =>
  blocks.flatMap(block => Array.from({ length: instancesOf(block) }, () => block))

/**
 * Turns a block tree into a layout tree:
 * - expands `repeat` into consecutive siblings (also in slot lists),
 * - gives every node a unique ID,
 * - normalizes `props` (always present).
 *
 * @example
 * ```ts
 * layout(node('grid', { children: [node('hero', { slots: { media: node('image') } }), repeat(node('card'), 2)] }), 'news')
 * // news            grid
 * // ├ news.0        hero
 * // │ └ news.0:media image   (slot)
 * // ├ news.1        card
 * // └ news.2        card
 * ```
 */
export function layout<C>(block: BlockDefinition<C>, prefix: string, options: LayoutOptions = {}): LayoutNode<C> {
  const id = options.id ?? defaultId
  const seen = new Set<string>()

  if (instancesOf(block) > 1) {
    throw new RangeError(`layout: root "${block.component}" cannot have repeat > 1 — wrap it in a container`)
  }

  const build = (source: BlockDefinition<C>, path: PathSegment[], parentId?: string): LayoutNode<C> => {
    const { component, props, alias, slots, children } = source as {
      component: string
      props?: Record<string, unknown>
      alias?: string
      slots?: Record<string, BlockDefinition<C> | BlockDefinition<C>[] | undefined>
      children?: BlockDefinition<C>[]
    }
    const nodeId = id({ prefix, path, parentId, component, alias })

    if (seen.has(nodeId)) {
      throw new Error(`layout: duplicate ID "${nodeId}"`)
    }
    seen.add(nodeId)

    const builtSlots: Record<string, LayoutNode<C> | LayoutNode<C>[]> = {}

    for (const [name, content] of Object.entries(slots ?? {})) {
      if (content === undefined) continue

      if (Array.isArray(content)) {
        builtSlots[name] = expand(content).map((child, index) => build(child, [...path, { slot: name, index }], nodeId))
      } else if (instancesOf(content) > 1) {
        throw new RangeError(`layout: slot "${name}" in "${component}" is a single slot — repeat > 1 requires a list slot`)
      } else {
        builtSlots[name] = build(content, [...path, { slot: name }], nodeId)
      }
    }

    const expandedChildren = expand(children ?? [])

    return {
      id: nodeId,
      component,
      props: { ...props },
      ...(alias !== undefined && { alias }),
      ...(options.trace && { trace: traceOf(component, props ?? {}, options.defaults) }),
      ...(Object.keys(builtSlots).length && { slots: builtSlots }),
      ...(expandedChildren.length && {
        children: expandedChildren.map((child, index) => build(child, [...path, index], nodeId)),
      }),
    } as LayoutNode<C>
  }

  return build(block, [])
}
