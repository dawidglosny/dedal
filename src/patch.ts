import { deepMerge } from './merge'
import { matches, parseSelector, type SelectorList } from './selectors'
import { mapTree, walk } from './tree'
import type { LayoutNode, PropSource, Selected } from './types'

/** Selector → props to apply. Entry order matters: the later one wins. */
export type PropsPatch = Record<string, Record<string, unknown>>

export type PatchOptions = {
  /** Records in `node.trace` which selector set a prop — debug mode. */
  trace?: boolean
  /** Section key recorded in the prop origin (`page` passes it for section patches). */
  section?: string
}

/**
 * Returns nodes matching the selector, in tree order (slots before children).
 * When the selector is just a component name (`'card'`), the result is typed with that component's props.
 */
export function select<C, S extends string>(root: LayoutNode<C>, selector: S): Selected<C, S>[] {
  const list = parseSelector(selector)
  const result: LayoutNode<C>[] = []

  walk(root, path => {
    if (matches(list, path)) result.push(path[path.length - 1].node)
  })

  return result as Selected<C, S>[]
}

/**
 * Applies props to nodes matching the selectors (also in slots). Returns a new tree; the input stays unchanged.
 *
 * Selectors are matched against the input tree (like CSS against the DOM), so a patch changing `size`
 * does not affect whether another patch with `[size=...]` hits the node.
 *
 * @example
 * ```ts
 * patch(root, {
 *   card: { size: 'small' },
 *   '#featured > card:first-child': { size: 'large' },
 *   'hero > :slot(media)': { ratio: '16:9' },
 * })
 * ```
 */
export function patch<C>(root: LayoutNode<C>, patches: PropsPatch, options: PatchOptions = {}): LayoutNode<C> {
  const compiled = Object.entries(patches).map(([selector, props]) => [selector, parseSelector(selector), props] as const)

  return mapTree(root, path => {
    const { node } = path[path.length - 1]
    let props = node.props as Record<string, unknown>
    let trace = node.trace

    for (const [selector, list, patchProps] of compiled) {
      if (!matches(list, path)) continue

      props = deepMerge(props, patchProps)

      if (options.trace) {
        const source: PropSource = { from: 'patch', selector, ...(options.section !== undefined && { section: options.section }) }
        trace = { ...trace, ...Object.fromEntries(Object.keys(patchProps).map(key => [key, source])) }
      }
    }

    if (props === node.props) return node

    return { ...node, props, ...(trace && { trace }) } as LayoutNode<C>
  })!
}

/**
 * Removes nodes matching the selectors (with their subtree, also from slots). Returns a new tree or `null`
 * when the root was removed. An empty slot disappears from `slots`.
 */
export function remove<C>(root: LayoutNode<C>, selector: string | string[]): LayoutNode<C> | null {
  const lists: SelectorList[] = (Array.isArray(selector) ? selector : [selector]).map(parseSelector)

  return mapTree(root, path => (lists.some(list => matches(list, path)) ? null : path[path.length - 1].node))
}
