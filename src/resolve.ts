import type { DataMap } from './assign'
import { describeValue } from './describe'
import { deepMerge } from './merge'
import { WIRE_VERSION, type PageResult } from './page'
import type { ComponentName, LayoutNode, PropSource, PropsOf } from './types'

/** Input of the data-to-props mapping for component `N`. */
export type ToPropsInput<C, N extends ComponentName<C>, Data = unknown, Ctx = unknown> = {
  /** Props from the layout (defaults + template + patches). */
  props: Partial<PropsOf<C, N>>
  /** Data assigned to the node; `undefined` when the node received no data. */
  data: Data | undefined
  node: LayoutNode<C, N>
  ctx: Ctx
}

/**
 * Mapping of data to component props. Must be pure (no IO) — `resolve` may run on either side of the network.
 * Method syntax lets the implementation narrow the `data` type, e.g. `card({ props, data }: ToPropsInput<C, 'card', Article>)`.
 */
export type ToProps<C> = {
  [N in ComponentName<C>]?: {
    map(input: ToPropsInput<C, N>): Partial<PropsOf<C, N>>
  }['map']
}

/** Node ready to render: component, props, slots, children. */
export type ResolvedNode<C, N extends ComponentName<C> = ComponentName<C>> = N extends ComponentName<C>
  ? {
      /** Node ID — key for the renderer. */
      key: string
      component: N
      props: Partial<PropsOf<C, N>>
      slots?: Record<string, ResolvedNode<C> | ResolvedNode<C>[]>
      children?: ResolvedNode<C>[]
      /** Prop origins — only with `trace: true`. */
      trace?: Record<string, PropSource>
    }
  : never

export type { PropSource }

/** A problem `resolve` worked around without breaking the page — bad data, an exception in `toProps`, data without a node. */
export type ResolveIssue = {
  /** Node ID or data key. */
  id: string
  message: string
}

/** Options of `resolve()`: `toProps`, the `ctx` passed to it, `trace` and `onIssue` (`collect` or `throw`). */
export type ResolveOptions<C> = {
  toProps?: ToProps<C>
  /** Context passed to `toProps` (e.g. platform). */
  ctx?: unknown
  /** Attaches `trace` to each node: prop origin from the layout (`node.trace`, when the layout was built with `trace`) or `data`. */
  trace?: boolean
  /** `'collect'` (default) — issues go to `issues`, rendering continues; `'throw'` — the first issue aborts. */
  onIssue?: 'collect' | 'throw'
}

/** The result of `resolveTree()` — a single resolved tree with its issues. */
export type ResolvedTree<C> = {
  tree: ResolvedNode<C>
  issues: ResolveIssue[]
}

/** The result of `resolve()` — what a renderer gets: sections with their trees of final props, and the issues `resolve` worked around. Plain JSON. */
export type ResolvedPage<C> = {
  dedal: typeof WIRE_VERSION
  /** `deferred: true` — fallback of a deferred section; the section itself comes from `page.section()` in a separate request. */
  sections: { key: string; tree: ResolvedNode<C>; deferred?: true }[]
  issues: ResolveIssue[]
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

type Mapper = (input: ToPropsInput<never, never>) => unknown

/**
 * Combines the layout with data into a tree ready to render.
 *
 * For each node computes props: `toProps[component]({ props, data, node, ctx })`, and without a mapping —
 * a deep merge of layout props with data (data wins). The mapping is also called for nodes without data.
 *
 * Issues (non-object data without a mapping, an exception in the mapping, data without a node) do not abort rendering —
 * they go to `issues`, and the node gets props from the layout. `onIssue: 'throw'` turns this into an exception.
 */
export function resolveTree<C>(root: LayoutNode<C>, data: DataMap = {}, options: ResolveOptions<C> = {}): ResolvedTree<C> {
  const issues: ResolveIssue[] = []
  const mappings = (options.toProps ?? {}) as Record<string, Mapper | undefined>

  const issue = (id: string, message: string) => {
    if (options.onIssue === 'throw') throw new Error(`resolve: ${id}: ${message}`)
    issues.push({ id, message })
  }

  const propsFor = (node: LayoutNode<C>): Record<string, unknown> => {
    const layoutProps = node.props as Record<string, unknown>
    const hasData = Object.hasOwn(data, node.id)
    const nodeData = hasData ? data[node.id] : undefined
    const mapping = mappings[node.component]

    if (mapping) {
      let mapped: unknown
      try {
        mapped = mapping({ props: layoutProps, data: nodeData, node, ctx: options.ctx } as never)
      } catch (error) {
        issue(node.id, `toProps("${node.component}") threw: ${(error as Error).message} — the node keeps its layout props`)
        return layoutProps
      }

      if (!isPlainObject(mapped)) {
        issue(node.id, `toProps("${node.component}") must return an object, got ${describeValue(mapped)} — the node keeps its layout props`)
        return layoutProps
      }

      return mapped
    }

    if (!hasData) return layoutProps

    if (!isPlainObject(nodeData)) {
      issue(
        node.id,
        `data for "${node.component}" is not an object (got ${describeValue(nodeData)}) — pass an object or add toProps for "${node.component}"; the node keeps its layout props`
      )
      return layoutProps
    }

    return deepMerge(layoutProps, nodeData)
  }

  const traceFor = (node: LayoutNode<C>, props: Record<string, unknown>) => {
    const layoutProps = node.props as Record<string, unknown>

    return Object.fromEntries(
      Object.keys(props).map(key => [
        key,
        Object.hasOwn(layoutProps, key) && sameValue(layoutProps[key], props[key])
          ? (node.trace?.[key] ?? { from: 'layout' })
          : { from: 'data' },
      ])
    ) as Record<string, PropSource>
  }

  const build = (node: LayoutNode<C>): ResolvedNode<C> => {
    const props = propsFor(node)
    const slots = node.slots
      ? Object.fromEntries(
          Object.entries(node.slots).map(([name, content]) => [
            name,
            Array.isArray(content) ? content.map(build) : build(content),
          ])
        )
      : undefined

    return {
      key: node.id,
      component: node.component,
      props,
      ...(slots && { slots }),
      ...(node.children && { children: node.children.map(build) }),
      ...(options.trace && { trace: traceFor(node, props) }),
    } as ResolvedNode<C>
  }

  const tree = build(root)

  return { tree, issues }
}

/**
 * Combines the result of `page.build()` (or `page.assign()`) into pages ready to render.
 * Checks the envelope version and reports data that reached no node (e.g. a layout cache out of sync with data).
 */
export function resolve<C>(page: PageResult<C>, options: ResolveOptions<C> = {}): ResolvedPage<C> {
  if (page.dedal !== WIRE_VERSION) {
    throw new Error(`resolve: unsupported format version ${String(page.dedal)} (supported: ${WIRE_VERSION})`)
  }

  const issues: ResolveIssue[] = []
  const sections = page.sections.map(({ key, layout, deferred }) => {
    const resolved = resolveTree(layout, page.data, options)
    issues.push(...resolved.issues)
    return { key, tree: resolved.tree, ...(deferred && { deferred }) }
  })

  const ids = new Set<string>()
  for (const { tree } of sections) collectKeys(tree, ids)

  for (const id of Object.keys(page.data)) {
    if (!ids.has(id)) {
      const message = 'data for an ID that has no node in the layout — layout and data are out of sync (e.g. a cached layout with fresh data); the data is ignored'
      if (options.onIssue === 'throw') throw new Error(`resolve: ${id}: ${message}`)
      issues.push({ id, message })
    }
  }

  return { dedal: WIRE_VERSION, sections, issues }
}

function collectKeys<C>(node: ResolvedNode<C>, keys: Set<string>) {
  keys.add(node.key)
  for (const content of Object.values(node.slots ?? {})) {
    for (const child of Array.isArray(content) ? content : [content]) collectKeys(child, keys)
  }
  node.children?.forEach(child => collectKeys(child, keys))
}
