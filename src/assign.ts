import { describeValue } from './describe'
import { select } from './patch'
import { mapTree, walk } from './tree'
import type { LayoutNode } from './types'

/** What to do with a node that ran out of data. */
export type ShortagePolicy = 'remove' | 'keep' | 'error'

/** What to do with data that ran out of nodes. */
export type SurplusPolicy = 'ignore' | 'error'

export type AssignPolicies = {
  /** Defaults to `'remove'`. */
  onShortage?: ShortagePolicy
  /** Defaults to `'ignore'`. */
  onSurplus?: SurplusPolicy
}

/** Data for a selector: a list or a list with its own policies. `null` / `undefined` in the list = no data for the node. */
export type Binding = readonly unknown[] | ({ items: readonly unknown[] } & AssignPolicies)

/** Selector → data. Entry order matters: an earlier selector claims nodes first. */
export type Bindings = Record<string, Binding>

/** Data by node ID. */
export type DataMap = Record<string, unknown>

export type BindingReport = {
  selector: string
  /**
   * IDs of nodes claimed by the selector, in assignment order (with data = `nodes` without `missing`).
   * Only with `trace` — without debug mode the report (and the JSON on the wire / in the cache) does not change.
   */
  nodes?: string[]
  /** Nodes matched and claimed by this selector. */
  matched: number
  /** Nodes that received data. */
  assigned: number
  /** Nodes without data. */
  missing: string[]
  /** Number of data items without a node. */
  unused: number
  /**
   * Data items without a node: index in the binding's data and a value preview (JSON, up to ~80 chars).
   * Only with `trace` — like `nodes`.
   */
  unusedItems?: { index: number; preview: string }[]
  /** Number of data items the binding received (including `null` / `undefined`). Only with `trace` — like `nodes`. */
  received?: number
  onShortage: ShortagePolicy
}

export type AssignReport = {
  bindings: BindingReport[]
  /** Nodes removed by `onShortage: 'remove'` (without their descendants). */
  removed: string[]
  /** Data dropped because its node disappeared together with a removed ancestor. */
  dropped: string[]
}

export type AssignResult<C> = {
  /** Layout after removing nodes without data; `null` when the root was removed. */
  layout: LayoutNode<C> | null
  data: DataMap
  report: AssignReport
}

/** Value preview for the report: object — first 3 primitive fields (id, title…), the rest — JSON; truncated to `max` chars. */
const preview = (value: unknown, max = 80) => {
  if (Array.isArray(value)) return `[${value.length} el.]`
  const shown =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, field]) => ['string', 'number', 'boolean'].includes(typeof field))
            .slice(0, 3)
        )
      : value
  let text: string
  try {
    text = JSON.stringify(shown) ?? String(shown)
  } catch {
    text = String(shown)
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const normalize = (selector: string, binding: Binding) => {
  if (Array.isArray(binding)) return { items: binding as readonly unknown[] }
  if (binding && Array.isArray((binding as { items?: unknown }).items)) return binding as { items: readonly unknown[] } & AssignPolicies

  throw new TypeError(`assign: data for "${selector}" must be an array or an object { items: [] }, got ${describeValue(binding)}`)
}

/**
 * Assigns data to layout nodes via selectors. Data items go, one by one, to the nodes matching
 * the selector, in tree order (slots before children).
 *
 * - Selectors are processed in entry order; a node claimed by an earlier selector is skipped
 *   by later ones — which is why more specific selectors (`#hero`) are listed before general ones (`card`).
 * - A claimed node without data is subject to `onShortage`: `'remove'` (default) removes it from the layout,
 *   `'keep'` keeps it without data, `'error'` throws.
 * - Surplus data is subject to `onSurplus`: `'ignore'` (default) or `'error'`.
 *
 * Policies can be set for the whole call and overridden for a single selector: `{ items, onShortage }`.
 * The input stays unchanged; when nothing was removed, the same layout is returned.
 *
 * @example
 * ```ts
 * const { layout, data, report } = assign(root, {
 *   '#hero': [hero],
 *   'heading': [{ title: 'Najnowsze' }],
 *   card: articles,
 *   'profile': { items: profiles, onShortage: 'keep' },
 * })
 * ```
 */
export function assign<C>(
  root: LayoutNode<C>,
  bindings: Bindings,
  policies: AssignPolicies = {},
  options: { trace?: boolean } = {}
): AssignResult<C> {
  const claimed = new Set<string>()
  const toRemove = new Set<string>()
  const data: DataMap = {}
  const reports: BindingReport[] = []
  const errors: string[] = []

  for (const [selector, binding] of Object.entries(bindings)) {
    const {
      items,
      onShortage = policies.onShortage ?? 'remove',
      onSurplus = policies.onSurplus ?? 'ignore',
    } = normalize(selector, binding)

    const nodes = select(root, selector).filter(node => !claimed.has(node.id))
    const missing: string[] = []

    nodes.forEach((node, index) => {
      claimed.add(node.id)
      const item = items[index]

      if (item === undefined || item === null) missing.push(node.id)
      else data[node.id] = item
    })

    const unused = Math.max(0, items.length - nodes.length)

    if (missing.length && onShortage === 'error') {
      errors.push(`"${selector}": missing data for ${missing.length} node(s) (${missing.join(', ')}) — onShortage: 'error'`)
    }
    if (unused && onSurplus === 'error') {
      errors.push(`"${selector}": ${unused} data item(s) without a node — the selector matches ${nodes.length} node(s) (onSurplus: 'error')`)
    }
    if (onShortage === 'remove') missing.forEach(id => toRemove.add(id))

    reports.push({
      selector,
      ...(options.trace && { nodes: nodes.map(({ id }) => id), received: items.length }),
      matched: nodes.length,
      assigned: nodes.length - missing.length,
      missing,
      unused,
      ...(options.trace &&
        unused > 0 && { unusedItems: items.slice(nodes.length).map((item, i) => ({ index: nodes.length + i, preview: preview(item) })) }),
      onShortage,
    })
  }

  if (errors.length) {
    throw new Error(`assign:\n${errors.map(error => `  - ${error}`).join('\n')}`)
  }

  // nothing removed — all nodes with data are alive
  if (!toRemove.size) return { layout: root, data, report: { bindings: reports, removed: [], dropped: [] } }

  const layout = mapTree(root, path => {
    const { node } = path[path.length - 1]
    return toRemove.has(node.id) ? null : node
  })

  const alive = new Set<string>()
  if (layout) walk(layout, path => alive.add(path[path.length - 1].node.id))

  const dropped = Object.keys(data).filter(id => !alive.has(id))
  for (const id of dropped) delete data[id]

  const removed = [...toRemove].filter(id => !alive.has(id))

  return { layout, data, report: { bindings: reports, removed, dropped } }
}
