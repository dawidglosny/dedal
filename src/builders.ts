import type { BlockDefinition, BlockOf, ComponentName } from './types'

/** `node()` options: everything from the block except the component name. Props go before children. */
export type NodeOptions<C, N extends ComponentName<C>> = Omit<BlockOf<C, N>, 'component'>

/** The template builders — `node`, `repeat`, `clone` — typed by the contract. */
export type Builders<C> = {
  /**
   * Creates a component block — exactly what is passed, typed by the contract. Component defaults are not added here
   * but when the page is built (`layout()`), so a block from code and one parsed from JSON behave the same, and a block
   * saved as JSON doesn't carry the defaults of the day it was created.
   *
   * @example
   * ```ts
   * node('grid', {
   *   props: { columns: 2 },
   *   children: [node('card', { repeat: 4, props: { size: 'small' } })],
   * })
   * ```
   */
  node<N extends ComponentName<C>>(component: N, options?: NodeOptions<C, N>): BlockOf<C, N>

  /** Returns a copy of the block with `repeat` set. */
  repeat<B extends BlockDefinition<C>>(block: B, count: number): B

  /** Repeats a sequence of blocks `count` times as consecutive siblings: `clone(2, a, b)` → `[a, b, a, b]`. */
  clone(count: number, ...blocks: BlockDefinition<C>[]): BlockDefinition<C>[]
}

const assertCount = (fn: string, count: number) => {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`${fn}: count must be an integer >= 1, got ${count}`)
  }
}

export function createBuilders<C extends object>(): Builders<C> {
  const node = <N extends ComponentName<C>>(component: N, options: NodeOptions<C, N> = {}): BlockOf<C, N> =>
    ({ component, ...options, props: { ...options.props } }) as BlockOf<C, N>

  const repeat = <B extends BlockDefinition<C>>(block: B, count: number): B => {
    assertCount('repeat', count)

    return { ...block, repeat: count }
  }

  const clone = (count: number, ...blocks: BlockDefinition<C>[]): BlockDefinition<C>[] => {
    assertCount('clone', count)

    return Array.from({ length: count }).flatMap(() => blocks)
  }

  return { node, repeat, clone }
}
