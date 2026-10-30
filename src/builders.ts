import { deepMerge } from './merge'
import type { BlockDefinition, BlockOf, ComponentDefaults, ComponentName } from './types'

/** `node()` options: everything from the block except the component name. Props go before children. */
export type NodeOptions<C, N extends ComponentName<C>> = Omit<BlockOf<C, N>, 'component'>

export type BuildersOptions<C> = {
  /** Default component props, merged with the props passed to `node()`. */
  defaults?: ComponentDefaults<C>
}

export type Builders<C> = {
  /**
   * Creates a component block. Default props from `defaults` are deep-merged with `options.props`
   * (passed values win, arrays and `undefined` replace the defaults).
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

export function createBuilders<C extends object>({ defaults = {} }: BuildersOptions<C> = {}): Builders<C> {
  const node = <N extends ComponentName<C>>(component: N, options: NodeOptions<C, N> = {}): BlockOf<C, N> => {
    const componentDefaults = (defaults as Record<string, Record<string, unknown> | undefined>)[component]
    const props = deepMerge(componentDefaults ?? {}, (options.props ?? {}) as Record<string, unknown>)

    return { component, ...options, props } as BlockOf<C, N>
  }

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
