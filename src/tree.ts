import type { PathEntry } from './selectors'
import type { LayoutNode } from './types'

/** Path element with a layout node. */
export type TreeEntry<C> = PathEntry & { node: LayoutNode<C> }

/** Path from the root to a node. */
export type TreePath<C> = TreeEntry<C>[]

export const rootPath = <C>(root: LayoutNode<C>): TreePath<C> => [{ node: root, index: 0, count: 1 }]

/**
 * Walks the tree in document order: slots first (in key order), then children.
 *
 * The path passed to `visit` is shared and changes after the call returns —
 * it may be read only during `visit` (store nodes, not the path).
 */
export function walk<C>(root: LayoutNode<C>, visit: (path: TreePath<C>) => void): void {
  const path = rootPath(root)

  const enter = (entry: TreeEntry<C>) => {
    path.push(entry)
    step()
    path.pop()
  }

  const step = () => {
    visit(path)
    const { node } = path[path.length - 1]

    if (node.slots) {
      for (const slot of Object.keys(node.slots)) {
        const content = node.slots[slot]

        if (Array.isArray(content)) {
          for (let index = 0; index < content.length; index++) {
            enter({ node: content[index], index, count: content.length, slot })
          }
        } else {
          enter({ node: content, index: 0, count: 1, slot })
        }
      }
    }

    const children = node.children
    if (children) {
      for (let index = 0; index < children.length; index++) {
        enter({ node: children[index], index, count: children.length })
      }
    }
  }

  step()
}

/**
 * Rebuilds the tree. `fn` gets the path in the input tree and returns a node (the same or changed)
 * or `null` to remove it together with its subtree. Descendants are always matched against the input tree.
 *
 * Unchanged subtrees are shared; when nothing changed, the same root is returned.
 * The path passed to `fn` is shared — it may be read only during the call.
 */
export function mapTree<C>(
  root: LayoutNode<C>,
  fn: (path: TreePath<C>) => LayoutNode<C> | null
): LayoutNode<C> | null {
  const path = rootPath(root)

  const enter = (entry: TreeEntry<C>) => {
    path.push(entry)
    const rebuilt = rebuild()
    path.pop()
    return rebuilt
  }

  const rebuild = (): LayoutNode<C> | null => {
    const source = path[path.length - 1].node
    const self = fn(path)

    if (self === null) return null

    let changed = self !== source
    let slots: Record<string, LayoutNode<C> | LayoutNode<C>[]> | undefined

    if (source.slots) {
      slots = {}

      for (const slot of Object.keys(source.slots)) {
        const content = source.slots[slot]

        if (Array.isArray(content)) {
          const rebuilt: LayoutNode<C>[] = []

          for (let index = 0; index < content.length; index++) {
            const child = enter({ node: content[index], index, count: content.length, slot })
            if (child !== content[index]) changed = true
            if (child) rebuilt.push(child)
          }

          if (rebuilt.length) slots[slot] = rebuilt
        } else {
          const child = enter({ node: content, index: 0, count: 1, slot })
          if (child !== content) changed = true
          if (child) slots[slot] = child
        }
      }
    }

    let children: LayoutNode<C>[] | undefined

    if (source.children) {
      children = []

      for (let index = 0; index < source.children.length; index++) {
        const original = source.children[index]
        const child = enter({ node: original, index, count: source.children.length })
        if (child !== original) changed = true
        if (child) children.push(child)
      }
    }

    if (!changed) return source

    const { slots: _slots, children: _children, ...rest } = self as LayoutNode<C> & Record<string, unknown>

    return {
      ...rest,
      ...(slots && Object.keys(slots).length && { slots }),
      ...(children?.length && { children }),
    } as LayoutNode<C>
  }

  return rebuild()
}
