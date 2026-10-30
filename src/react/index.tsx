import { createElement, Fragment, type ComponentType, type ReactElement, type ReactNode } from 'react'
import type { ResolvedNode, ResolvedPage } from '../resolve'
import type { ComponentName, PropsOf, SlotName, Slot } from '../types'

/** Props received by a registry component: contract props, slots as React elements, and children. */
export type RenderProps<C, N extends ComponentName<C>> = PropsOf<C, N> & {
  [K in SlotName<C, N>]?: [NonNullable<C[N][K]>] extends [Slot[]] ? ReactNode[] : ReactNode
} & { children?: ReactNode }

/**
 * Frontend registry: component name → implementation (your own design system, MUI, Radix, …).
 * Requires all components from the contract — `satisfies Registry<Contract>` detects a mismatch at compile time.
 */
export type Registry<C> = { [N in ComponentName<C>]: ComponentType<RenderProps<C, N>> }

/** Component rendered in place of a component missing from the registry (e.g. older frontend, newer server). */
export type FallbackProps = { component: string; nodeKey: string }

/** The options of the React renderer: the registry, a `fallback` for components missing from it, and `debug` markers for devtools. */
export type RenderOptions<C> = {
  registry: Registry<C> | Partial<Registry<C>>
  /** Renders nothing by default. */
  fallback?: ComponentType<FallbackProps>
  /**
   * Debug mode: each node wrapped in `<dedal-node style="display: contents" data-dedal-key="…">` — devtools link
   * a page element to a node without the registry's cooperation. Changes the DOM tree (structure-dependent CSS selectors,
   * `<table>`, `<ul>`, `<select>` may behave differently) — debug mode only.
   */
  debug?: boolean
}

/** Node marker in debug mode — an element without its own box (`display: contents`). */
const marker = (key: string, element: ReactElement | null, missing?: string) =>
  createElement('dedal-node', { key, 'data-dedal-key': key, ...(missing && { 'data-dedal-missing': missing }), style: { display: 'contents' } }, element)

/**
 * Turns a `ResolvedNode` into a React element. Slots go to props named after the slot (a list slot as an array
 * of elements), layout children — to `children` (they override the contract's `children` prop only when they exist).
 */
export function renderNode<C>(node: ResolvedNode<C>, options: RenderOptions<C>): ReactElement | null {
  const Component = (options.registry as Record<string, ComponentType<Record<string, unknown>> | undefined>)[
    node.component
  ]

  if (!Component) {
    const missing = options.fallback
      ? createElement(options.fallback, { key: node.key, component: node.component, nodeKey: node.key })
      : null
    return options.debug ? marker(node.key, missing, node.component) : missing
  }

  const render = (child: ResolvedNode<C>) => renderNode(child, options)
  const slots = Object.fromEntries(
    Object.entries(node.slots ?? {}).map(([name, content]) => [
      name,
      Array.isArray(content) ? content.map(render) : render(content),
    ])
  )

  const props = { ...(node.props as Record<string, unknown>), ...slots, key: node.key }

  const element = node.children
    ? createElement(Component, props, ...node.children.map(render))
    : createElement(Component, props)

  return options.debug ? marker(node.key, element) : element
}

/** Escapes JSON for embedding in `<script>`: `<` → `\u003c`, so neither `</script>` nor `<!--` in data closes the script. */
const scriptSafe = (json: string) => json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

/**
 * Embeds the devtools payload (`inspect()` from `dedal/devtools`) in the page as `<script type="application/json" data-dedal-devtools>`.
 * The panel collects all such scripts — also from streamed deferred sections. Render only in debug mode.
 */
export function DevtoolsData({ payload }: { payload: unknown }): ReactElement {
  return createElement('script', {
    type: 'application/json',
    'data-dedal-devtools': '',
    dangerouslySetInnerHTML: { __html: scriptSafe(JSON.stringify(payload)) },
  })
}

/** Deferred section: key and the rendered fallback. */
export type DeferredSectionProps = { sectionKey: string; fallback: ReactNode }

/** Props of `<Render>`: the tree to render (a page or a single tree), the renderer options and how to render deferred sections. */
export type RenderComponentProps<C> = RenderOptions<C> & {
  /** Result of `resolve()` (a page) or a single tree from `resolveTree()`. */
  tree: ResolvedPage<C> | ResolvedNode<C>
  /**
   * Render of a deferred section (`deferred: true`); by default just the fallback. In Next / RSC — `<Suspense>` with streaming:
   * `deferred={({ sectionKey, fallback }) => <Suspense fallback={fallback}><Section sectionKey={sectionKey} /></Suspense>}`,
   * where `Section` is an async server component with `page.section()` + `resolve` + `<Render>`.
   */
  deferred?: (props: DeferredSectionProps) => ReactNode
}

/**
 * Renders a page or tree from `resolve()`. No hooks or state — works in React Server Components,
 * during SSR and on the client; registry components may be client components.
 *
 * @example
 * ```tsx
 * export default async function Page() {
 *   const resolved = ui.resolve(await home.build(ctx), { ctx })
 *   return <Render tree={resolved} registry={registry} />
 * }
 * ```
 */
export function Render<C>({ tree, deferred, ...options }: RenderComponentProps<C>): ReactElement {
  if ('sections' in tree) {
    return createElement(
      Fragment,
      null,
      ...tree.sections.map(section => {
        const rendered = renderNode(section.tree, options)
        const content =
          section.deferred && deferred ? deferred({ sectionKey: section.key, fallback: rendered }) : rendered

        return createElement(Fragment, { key: section.key }, content)
      })
    )
  }

  return createElement(Fragment, null, renderNode(tree, options))
}
