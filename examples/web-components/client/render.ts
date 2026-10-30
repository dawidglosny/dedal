import type { ResolvedNode, ResolvedPage } from 'dedal'

/** The registry of a Web Components frontend: component name → custom element tag. */
export type Registry<C> = { [N in keyof C]: string }

/**
 * Renders a resolved node as DOM — the whole renderer:
 * - props → element properties,
 * - slots → children with the `slot` attribute (they land in the element's `<slot name="…">`),
 * - children → children (the default `<slot>`).
 */
export function renderNode<C>(node: ResolvedNode<C>, registry: Registry<C>): Element {
  const tag = registry[node.component as keyof C]
  if (!tag) {
    const missing = document.createElement('div')
    missing.className = 'missing'
    missing.textContent = `Missing component “${String(node.component)}”`
    return missing
  }

  const element = document.createElement(tag)
  Object.assign(element, node.props)
  for (const [name, content] of Object.entries(node.slots ?? {})) {
    const nodes: ResolvedNode<C>[] = Array.isArray(content) ? content : [content]
    for (const child of nodes) element.append(Object.assign(renderNode(child, registry), { slot: name }))
  }
  for (const child of node.children ?? []) element.append(renderNode(child, registry))
  return element
}

/** Renders the page; every section root is marked with its key, so a deferred section can be swapped in later. */
export function renderPage<C>(page: ResolvedPage<C>, registry: Registry<C>, root: Element) {
  root.replaceChildren(...page.sections.map(({ key, tree }) => section(key, renderNode(tree, registry))))
}

const section = (key: string, element: Element) => {
  element.setAttribute('data-section', key)
  return element
}

/**
 * Swaps a deferred section's placeholder for the section itself — or removes the placeholder when the section's
 * own request returned no section (its loader failed with `optional`, or it was empty).
 */
export function replaceSection<C>(root: Element, key: string, result: ResolvedPage<C>, registry: Registry<C>) {
  const placeholder = root.querySelector(`[data-section="${key}"]`)
  const [built] = result.sections
  if (!placeholder) return
  if (built) placeholder.replaceWith(section(key, renderNode(built.tree, registry)))
  else placeholder.remove()
}
