import { assign, type AssignPolicies, type AssignResult, type Bindings } from './assign'
import { createBuilders } from './builders'
import { createCache, type CacheKey, type CacheOptions } from './cache'
import type { ContractDefinition, InferContract } from './contract'
import { createAsyncContext, type AsyncContext, type AsyncLocalStorageClass } from './timing'
import { createQuery, namespaced, PAGE_NAMESPACE, QUERY_NAMESPACE, type Query, type QueryOptions } from './query'
import { layout, type IdGenerator } from './layout'
import type { DataMap } from './assign'
import { page, section, type PageResult, type Page, type PageDefinition, type SectionDefinition, type SectionOptions } from './page'
import { patch, remove, select, type PatchOptions, type PropsPatch } from './patch'
import {
  resolve,
  resolveTree,
  type ResolvedPage,
  type ResolvedTree,
  type ResolveOptions,
  type ToProps,
} from './resolve'
import type { BlockDefinition, ComponentDefaults, LayoutNode, Selected } from './types'
import { validateTemplate, type ValidationResult } from './validate'

/** Options of `createDedal()`: the contract, default props, `toProps` mappings, the ID generator, assignment policies and the cache. */
export type DedalOptions<C> = {
  /**
   * The contract as a value (`defineContract`) — the instance is typed by it, and templates from outside the code can be
   * checked with `ui.validate`. Without it, the contract is the type argument: `createDedal<Contract>()`.
   */
  contract?: ContractDefinition
  /** Default component props, merged under every node's props when the page is built — for templates in code and from JSON alike. */
  defaults?: ComponentDefaults<C>
  /** Layout node ID generator. */
  id?: IdGenerator
  /** Default `assign()` policies for this instance (default `onShortage: 'remove'`, `onSurplus: 'ignore'`). */
  assign?: AssignPolicies
  /** Data-to-props mappings used by `resolve()` — a pure module next to the contract. */
  toProps?: ToProps<C>
  /**
   * Instance page cache: shared store and default times (`staleTime` 5 s, `maxAge` 5 min).
   * A page is cached only with the `page({ cache: { key } })` option.
   */
  cache?: CacheOptions
  /**
   * `AsyncLocalStorage` class (`import { AsyncLocalStorage } from 'node:async_hooks'`) for query timings in debug builds —
   * it attributes query calls to the build and the loader. Default: the global `AsyncLocalStorage` (Next.js, edge runtimes);
   * without it debug builds show loader timings only.
   */
  AsyncLocalStorage?: AsyncLocalStorageClass
}

/** Instance `resolve()` options — mappings come from `createDedal({ toProps })`. */
export type InstanceResolveOptions<C> = Omit<ResolveOptions<C>, 'toProps'>

/**
 * Creates an engine instance. The contract is either a value — `createDedal({ contract })`, typed by it and able to
 * validate templates — or a type argument, `createDedal<Contract>()`. Default props and the ID generator are given once,
 * and all instance functions are already typed by the contract.
 *
 * @example
 * ```ts
 * export const ui = createDedal({ contract, defaults: { card: { size: 'md' } } })
 * export const { node, repeat, clone } = ui
 * ```
 */
export function createDedal<C extends object = never, const D extends ContractDefinition = ContractDefinition>(
  options: DedalOptions<ContractOf<C, D>> & { contract?: D } = {}
): Dedal<ContractOf<C, D>> {
  return createInstance(options as DedalOptions<ContractOf<C, D>>)
}

/** The instance's contract: the type argument when given (`createDedal<Contract>()`), otherwise inferred from `contract`. */
type ContractOf<C, D extends ContractDefinition> = [C] extends [never] ? InferContract<D> : C

function createInstance<C extends object>(options: DedalOptions<C>) {
  const { node, repeat, clone } = createBuilders<C>()
  const cache = createCache(options.cache)
  // created on first use: Next.js sets the global AsyncLocalStorage when the server starts, possibly after this module loads
  let asyncContext: AsyncContext | undefined | null = null
  const context = () => (asyncContext === null ? (asyncContext = createAsyncContext(options.AsyncLocalStorage)) : asyncContext)

  return {
    node,
    repeat,
    clone,
    layout: (block: BlockDefinition<C>, prefix: string, layoutOptions: { trace?: boolean } = {}): LayoutNode<C> =>
      layout(block, prefix, { id: options.id, defaults: options.defaults, ...layoutOptions }),
    patch: (root: LayoutNode<C>, patches: PropsPatch, patchOptions?: PatchOptions): LayoutNode<C> =>
      patch(root, patches, patchOptions),
    remove: (root: LayoutNode<C>, selector: string | string[]): LayoutNode<C> | null => remove(root, selector),
    select: <S extends string>(root: LayoutNode<C>, selector: S): Selected<C, S>[] => select(root, selector),
    assign: (root: LayoutNode<C>, bindings: Bindings, policies: AssignPolicies = {}, assignOptions?: { trace?: boolean }): AssignResult<C> =>
      assign(
        root,
        bindings,
        {
          onShortage: policies.onShortage ?? options.assign?.onShortage,
          onSurplus: policies.onSurplus ?? options.assign?.onSurplus,
        },
        assignOptions
      ),
    section: <Ctx = any>(key: string, block: BlockDefinition<C>, sectionOptions?: SectionOptions<C, Ctx>): SectionDefinition<C, Ctx> =>
      section(key, block, sectionOptions),
    page: <Ctx = void>(definition: PageDefinition<C, Ctx>): Page<C, Ctx> =>
      page(definition, { id: options.id, policies: options.assign, cache, defaults: options.defaults, context }),
    /**
     * Query — a cached data source, shared by pages and sections.
     * The result is frozen and shared — read-only.
     *
     * @example
     * ```ts
     * const menuQuery = ui.query({ key: ({ service }: { service: string }) => ['menu', service], fn: ({ service }) => api.menu(service) })
     * const menu = await menuQuery({ service: 'sport' })
     * ```
     */
    query: <P, T>(queryOptions: QueryOptions<P, T>): Query<P, T> => createQuery(cache, queryOptions, context),
    /** Removes page and query entries whose key starts with `prefix` from the cache; `[]` = all. */
    invalidate: async (prefix: CacheKey): Promise<void> => {
      await cache.invalidate(namespaced(PAGE_NAMESPACE, prefix)!)
      await cache.invalidate(namespaced(QUERY_NAMESPACE, prefix)!)
    },
    resolve: (result: PageResult<C>, resolveOptions: InstanceResolveOptions<C> = {}): ResolvedPage<C> =>
      resolve(result, { ...resolveOptions, toProps: options.toProps }),
    resolveTree: (root: LayoutNode<C>, data?: DataMap, resolveOptions: InstanceResolveOptions<C> = {}): ResolvedTree<C> =>
      resolveTree(root, data, { ...resolveOptions, toProps: options.toProps }),
    /** The contract given to `createDedal({ contract })`, if any. */
    contract: options.contract,
    /**
     * Checks a template from outside the code (a database, a CMS, a Figma export) against the contract: known components
     * and slots, the slot kind, props against their schemas, `repeat`. Props missing from the template are fine — data
     * fills them at `resolve`. Needs `createDedal({ contract })`.
     */
    validate: async (value: unknown, path = 'template'): Promise<ValidationResult<BlockDefinition<C>>> => {
      const errors = await validateTemplate(requireContract(options.contract), value, path)
      return errors.length ? { ok: false, errors } : { ok: true, value: value as BlockDefinition<C>, errors: [] }
    },
    /** `validate` for templates stored per section — `{ news: block, hero: block }`; paths start with the section key. */
    validateSections: async (value: unknown): Promise<ValidationResult<Record<string, BlockDefinition<C>>>> => {
      const contract = requireContract(options.contract)
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { ok: false, errors: [{ path: 'sections', message: 'expected an object: section key → block' }] }
      }
      const errors = (await Promise.all(Object.entries(value).map(([key, block]) => validateTemplate(contract, block, key)))).flat()
      return errors.length ? { ok: false, errors } : { ok: true, value: value as Record<string, BlockDefinition<C>>, errors: [] }
    },
  }
}

const requireContract = (contract: ContractDefinition | undefined): ContractDefinition => {
  if (!contract) throw new Error('validate: the instance has no contract value — create it with createDedal({ contract: defineContract({ … }) })')
  return contract
}

/** A Dedal instance — what `createDedal<Contract>()` returns: builders, `page`, `section`, `query`, `resolve`, `invalidate`. */
export type Dedal<C extends object> = ReturnType<typeof createInstance<C>>
