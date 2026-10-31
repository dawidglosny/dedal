import type { ContractDefinition } from './contract'
import { validateTemplate, type ValidationError } from './validate'
import { assign, type AssignPolicies, type AssignReport, type Bindings, type DataMap } from './assign'
import { createCache, hashKey, type Cache, type PageCacheOptions } from './cache'
import { describeValue } from './describe'
import { ms, now, type AsyncContext, type BuildTiming, type LoaderTiming, type TraceStore } from './timing'
import { layout, type IdGenerator } from './layout'
import { patch, remove, select, type PropsPatch } from './patch'
import { namespaced, PAGE_NAMESPACE } from './query'
import { walk } from './tree'
import type { BlockDefinition, ComponentDefaults, LayoutNode } from './types'

/** Wire format version. */
export const WIRE_VERSION = 1

/** Options of `ui.section()`: `remove`, `patch`, assignment `policies`, its own `data` loader, `optional`, `onEmpty`, `required` and `defer`. */
export type SectionOptions<C = any, Ctx = any> = {
  /** Selectors removed from the section layout (before `patch`). */
  remove?: string | string[]
  /** Props applied to the section layout (after `remove`). */
  patch?: PropsPatch
  /** `assign()` policies for this section. */
  policies?: AssignPolicies
  /**
   * Section data loader (IO) — bindings for this section. A section with a loader is self-contained (e.g. a shared header);
   * it caches through queries (`ui.query()`) inside. Data for this section from page `data` = error.
   */
  data?: (ctx: Ctx) => Bindings | Promise<Bindings>
  /** A section loader error removes the section (`report.failedSections`) instead of aborting `build`. */
  optional?: boolean
  /**
   * Deferred section: the page result holds only a placeholder (`fallback`, `deferred: true`), the loader is not called.
   * The section is built by a separate request — `page.section(key, ctx)` (server islands, `<Suspense>`, separate endpoint).
   */
  defer?: { fallback: BlockDefinition<C> }
  /**
   * What to do when a section expecting data (section loader or bindings from page `data`) got none —
   * static sections (without data) are not affected:
   * - `'remove'` (default) — the section disappears (`report.removedSections`),
   * - `'keep'` — it stays without data,
   * - `'error'` — exception (content required),
   * - block — replaces the section (empty state, e.g. "No results").
   *
   * Every empty section goes to `report.emptySections`.
   */
  onEmpty?: 'remove' | 'keep' | 'error' | BlockDefinition<C>
  /** Selector of nodes of which at least one must get data for the section not to be empty (e.g. `'tile-v2'`); any node by default. */
  required?: string
}

/** Page section: a block with a key. The key is the ID prefix of the section's nodes and the key of its data. */
export type SectionDefinition<C, Ctx = any> = SectionOptions<C, Ctx> & {
  key: string
  block: BlockDefinition<C>
}

/** Page data: section key → `assign()` bindings; `null` = the loader of an optional section failed (section removed). */
export type PageData = Record<string, Bindings | null>

/** What `ui.page()` takes: the sections (fixed or per `ctx`), the page data loader, the cache and the error hook. */
export type PageDefinition<C, Ctx> = {
  /**
   * Sections in render order; a function of `ctx` when they depend on context (platform, page, A/B…) — synchronous, or
   * async when the sections come from storage (templates in a database, a CMS, a Figma export).
   */
  // NoInfer: `Ctx` comes from the page definition (or the function parameter), not from the section loaders' type
  sections:
    | NoInfer<SectionDefinition<C, Ctx>>[]
    | ((ctx: Ctx) => NoInfer<SectionDefinition<C, Ctx>>[] | Promise<NoInfer<SectionDefinition<C, Ctx>>[]>)
  /** Page data loader (IO). Returns bindings per section — for sections without their own loader. */
  data?: (ctx: Ctx) => PageData | Promise<PageData>
  /**
   * Cache of the `build` result (stale-while-revalidate). Without this option the page is not cached.
   * The key must cover everything sections and data depend on — the personalized part as a deferred section.
   */
  cache?: PageCacheOptions<Ctx>
  /** Optional section loader error (for logs); the section is removed anyway. */
  onSectionError?: (error: unknown, info: { section: string }) => void
}

/** Section in the page result; `deferred: true` — placeholder of a deferred section (`layout` from `fallback`). */
export type SectionLayout<C> = {
  key: string
  layout: LayoutNode<C>
  deferred?: true
}

/** Section data source: page `data`, section loader, deferred section or no data. */
export type SectionSource = 'page' | 'section' | 'deferred' | 'none'

/** Page info in debug mode (`build(ctx, { trace: true })`). */
export type PageTrace<C = unknown> = {
  /** Section key → data source. */
  sources: Record<string, SectionSource>
  /** Page cache key for this `ctx` (`hashKey`) or `null` — page without cache or key `undefined`. */
  cacheKey: string | null
  /**
   * Layout of sections removed by data (`onShortage` removed the root, `onEmpty`) — before assignment.
   * Devtools use it to show what the section was looking for (e.g. a selector with a typo that left the section empty).
   */
  removedLayouts?: Record<string, LayoutNode<C>>
  /** Errors thrown by loaders of optional sections (`report.failedSections`): section key → error message. */
  sectionErrors?: Record<string, string>
  /** The page has a `cache` option — with `cacheKey: null` its `key` returned `undefined` for this ctx. */
  cacheOption?: true
  /** `remove` / `patch` selectors of each section and how many nodes they matched (0 = no effect). */
  layoutSelectors?: Record<string, LayoutSelectorReport[]>
  /** Stage, loader and query timings of this build. */
  timing?: BuildTiming
  /**
   * Templates that don't match the contract (`createDedal({ contract })`): the section blocks, deferred placeholders and
   * `onEmpty` blocks of this build, each error with its path. Reported, not thrown — the page still builds.
   */
  templateErrors?: ValidationError[]
}

/** A `remove` / `patch` selector of a section and the number of nodes it matched. */
export type LayoutSelectorReport = { kind: 'remove' | 'patch'; selector: string; matched: number }

/** The report of a build: `assign` per section, data without a section, removed, failed and empty sections, and — with `trace` — details for devtools. */
export type PageReport<C = unknown> = {
  /** `assign()` report per section (only sections that got data). */
  sections: Record<string, AssignReport>
  /** Data keys without a matching section. */
  unknownData: string[]
  /** Sections whose root was removed (by `remove` or missing data). */
  removedSections: string[]
  /** Optional sections removed because their loader threw. */
  failedSections: string[]
  /** Sections expecting data that got none (`onEmpty`) — removed, kept or replaced with an empty state. */
  emptySections: string[]
  /** Debug mode only (`trace: true`). */
  trace?: PageTrace<C>
}

/** Page build result — plain JSON, ready to send or to `resolve()`. */
export type PageResult<C> = {
  dedal: typeof WIRE_VERSION
  sections: SectionLayout<C>[]
  data: DataMap
  report: PageReport<C>
}

/** Instance-level options a page is created with (passed by `createDedal`, not set per page). */
export type PageOptions = {
  id?: IdGenerator
  /** Default component props — in debug mode they distinguish `default` from `template`. */
  defaults?: ComponentDefaults<unknown>
  policies?: AssignPolicies
  /** Instance cache; without it a page with the `cache` option gets its own in-memory cache. */
  cache?: Cache
  /** Async context for query timings in debug builds (`createDedal({ AsyncLocalStorage })`). */
  context?: () => AsyncContext | undefined
  /** The contract value — debug builds validate the templates against it (`report.trace.templateErrors`). */
  contract?: ContractDefinition
}

/** Page stage options. */
export type BuildOptions = {
  /**
   * Debug mode: props origin in `node.trace`, `report.trace` (section sources, cache key).
   * A build with `trace` bypasses the page cache — neither reads from nor writes to it.
   */
  trace?: boolean
}

/** A page — what `ui.page()` returns: `build`, its stages (`layout`, `load`, `assign`) and `section` for deferred sections. */
export type Page<C, Ctx> = {
  /** Stage 1: section layout without data (no data IO, cacheable). Deferred sections as placeholders. */
  layout(ctx: Ctx, options?: BuildOptions): Promise<{ sections: SectionLayout<C>[]; removedSections: string[] }>
  /** Stage 2: data from the page loader and section loaders (IO), in parallel; without deferred sections. */
  load(ctx: Ctx): Promise<PageData>
  /** Stage 3: assigning data to the section layout. */
  assign(sections: SectionLayout<C>[], data: PageData, ctx: Ctx): Promise<PageResult<C>>
  /** All stages in order; with the `cache` option — result from cache (outside debug mode). */
  build(ctx: Ctx, options?: BuildOptions): Promise<PageResult<C>>
  /**
   * A single section (e.g. deferred) — layout, its loader, assign; without page `data` and without the page cache.
   * The result is a `PageResult` with that one section, so `resolve` and the renderer work unchanged.
   */
  section(key: string, ctx: Ctx, options?: BuildOptions): Promise<PageResult<C>>
}

/** Creates a page section. */
export function section<C, Ctx = any>(
  key: string,
  block: BlockDefinition<C>,
  options: SectionOptions<C, Ctx> = {}
): SectionDefinition<C, Ctx> {
  return { key, block, ...options }
}

/**
 * Defines a page: a list of sections and a data loader.
 *
 * @example
 * ```ts
 * const home = page({
 *   sections: ({ device }) => [
 *     header,                                                   // shared section with its own loader
 *     section('news', device === 'mobile' ? newsMob : news, { patch: { card: { loading: 'eager' } } }),
 *     section('forYou', forYouBlock, { defer: { fallback: skeleton }, data: forUser }),
 *   ],
 *   data: async ctx => ({ news: { card: await getNews(ctx) } }),
 * })
 *
 * const result = await home.build({ device: 'mobile' })
 * ```
 */
export function page<C, Ctx = void>(definition: PageDefinition<C, Ctx>, options: PageOptions = {}): Page<C, Ctx> {
  const sectionsFor = async (ctx: Ctx) => {
    const sections = typeof definition.sections === 'function' ? await definition.sections(ctx) : definition.sections
    const keys = new Set<string>()

    for (const { key } of sections) {
      if (keys.has(key)) throw new Error(`page: duplicate section key "${key}"`)
      keys.add(key)
    }

    return sections
  }

  /** Debug builds with a contract: every template of these sections against it — reported, not thrown. */
  const templateErrorsOf = async (definitions: SectionDefinition<C, Ctx>[]): Promise<ValidationError[]> => {
    const contract = options.contract
    if (!contract) return []
    const checks = definitions.flatMap(({ key, block, defer, onEmpty }) => [
      validateTemplate(contract, block, key),
      ...(defer ? [validateTemplate(contract, defer.fallback, `${key}.defer.fallback`)] : []),
      ...(typeof onEmpty === 'object' ? [validateTemplate(contract, onEmpty, `${key}.onEmpty`)] : []),
    ])
    return (await Promise.all(checks)).flat()
  }

  /** Section layout: block → `remove` → `patch`; `null` when the root was removed. */
  /** Section layout: block → `remove` → `patch`; `null` when the root was removed. With `hits`, records selector matches. */
  const prepare = (
    { key, block, remove: removeSelectors, patch: props }: SectionDefinition<C, Ctx>,
    trace = false,
    hits?: LayoutSelectorReport[]
  ) => {
    try {
      let root: LayoutNode<C> | null = layout(block, key, { id: options.id, trace, defaults: options.defaults })

      if (removeSelectors) {
        if (hits) for (const selector of [removeSelectors].flat()) hits.push({ kind: 'remove', selector, matched: select(root, selector).length })
        root = remove(root, removeSelectors)
      }
      if (root && props) {
        if (hits) for (const selector of Object.keys(props)) hits.push({ kind: 'patch', selector, matched: select(root, selector).length })
        root = patch(root, props, { trace, section: key })
      }

      return root
    } catch (error) {
      throw new Error(`section "${key}": ${(error as Error).message}`, { cause: error })
    }
  }

  // stages work on a ready list of sections, so that `build` calls `sections(ctx)` once
  const layoutOf = (definitions: SectionDefinition<C, Ctx>[], trace = false) => {
    const sections: SectionLayout<C>[] = []
    const removedSections: string[] = []
    const layoutSelectors: Record<string, LayoutSelectorReport[]> = {}

    for (const definitionOfSection of definitions) {
      const { key, defer } = definitionOfSection

      if (defer) {
        sections.push({
          key,
          layout: layout(defer.fallback, key, { id: options.id, trace, defaults: options.defaults }),
          deferred: true,
        })
        continue
      }

      const hits: LayoutSelectorReport[] | undefined = trace ? [] : undefined
      const root = prepare(definitionOfSection, trace, hits)
      if (hits?.length) layoutSelectors[key] = hits
      if (root) sections.push({ key, layout: root })
      else removedSections.push(key)
    }

    // the built-in generator prefixes IDs with the (unique) section key; a custom one may repeat IDs across sections —
    // data is keyed by node ID for the whole page, so a duplicate would silently overwrite another section's data
    if (options.id) assertUniqueIds(sections)

    return { sections, removedSections, ...(Object.keys(layoutSelectors).length && { layoutSelectors }) }
  }

  /** Node IDs must be unique on the whole page (data is one map keyed by node ID). */
  const assertUniqueIds = (sections: SectionLayout<C>[]) => {
    const owner = new Map<string, string>()
    for (const { key, layout: root } of sections) {
      walk(root, path => {
        const { id } = path[path.length - 1].node
        const other = owner.get(id)
        if (other !== undefined && other !== key) {
          throw new Error(
            `page: duplicate node ID "${id}" in sections "${other}" and "${key}" — node IDs must be unique on the page (check the custom id generator)`
          )
        }
        owner.set(id, key)
      })
    }
  }

  /** Debug build timer: stage marks, loader timings and — with an async context — query calls. */
  const createTimer = () => {
    const origin = now()
    const marks: Partial<Record<'layout' | 'load' | 'assign', number>> = {}
    const loaders: LoaderTiming[] = []
    const context = options.context?.()
    const store: TraceStore | undefined = context && { origin, queries: [] }
    let last = origin

    return {
      origin,
      loaders,
      context,
      store,
      mark(stage: 'layout' | 'load' | 'assign') {
        const at = now()
        marks[stage] = ms(at - last)
        last = at
      },
      result(scope: string): BuildTiming {
        return {
          scope,
          total: ms(last - origin),
          layout: marks.layout ?? 0,
          load: marks.load ?? 0,
          assign: marks.assign ?? 0,
          loaders,
          ...(store && { queries: store.queries }),
        }
      },
    }
  }
  type Timer = ReturnType<typeof createTimer>

  /** Runs a loader; with a timer — measures it and (with an async context) attributes its queries to it. */
  const timed = async <R>(timer: Timer | undefined, loader: string, fn: () => R | Promise<R>): Promise<R> => {
    if (!timer) return fn()
    const start = now()
    let failed = false
    try {
      return await (timer.context && timer.store ? timer.context.run({ ...timer.store, loader }, fn) : fn())
    } catch (error) {
      failed = true
      throw error
    } finally {
      timer.loaders.push({ loader, start: ms(start - timer.origin), duration: ms(now() - start), ...(failed && { failed: true as const }) })
    }
  }

  /**
   * Runs page `data` (when `withPage`) and the `toLoad` section loaders in parallel.
   * Checks conflicts: data for a section with its own loader or for a deferred section returned by page `data`.
   */
  const loadWith = async (
    ctx: Ctx,
    definitions: SectionDefinition<C, Ctx>[],
    toLoad: SectionDefinition<C, Ctx>[],
    withPage: boolean,
    /** Filled with error messages of failed optional sections (debug only). */
    errors?: Record<string, string>,
    /** Debug only: loader timings; with `store`, each loader runs in the async context so its queries are attributed. */
    timing?: Timer
  ): Promise<PageData> => {
    const loaders = toLoad.filter(({ data }) => data)

    const [pageData, ...sectionData] = await Promise.all([
      withPage && definition.data ? timed(timing, 'page', () => definition.data!(ctx)) : ({} as PageData),
      ...loaders.map(async ({ key, data, optional }) => {
        try {
          return await timed(timing, key, () => data!(ctx))
        } catch (error) {
          if (!optional) {
            throw new Error(`section "${key}": loader threw: ${(error as Error).message}`, { cause: error })
          }
          definition.onSectionError?.(error, { section: key })
          if (errors) errors[key] = error instanceof Error ? error.message : String(error)
          return null
        }
      }),
    ])

    for (const { key, data, defer } of definitions) {
      if ((data || defer) && Object.hasOwn(pageData, key)) {
        throw new Error(
          `page: page data returned data for section "${key}", but a ${defer ? 'deferred section' : 'section with its own loader'} loads its own data — remove "${key}" from page data or drop the section's loader`
        )
      }
    }

    const result: PageData = { ...pageData }
    loaders.forEach(({ key }, index) => (result[key] = sectionData[index]))

    return result
  }

  const assignWith = (sections: SectionLayout<C>[], data: PageData, definitions: SectionDefinition<C, Ctx>[], trace = false) => {
    const definitionsByKey = new Map(definitions.map(definitionOfSection => [definitionOfSection.key, definitionOfSection]))
    const result: PageResult<C> = {
      dedal: WIRE_VERSION,
      sections: [],
      data: {},
      report: { sections: {}, unknownData: [], removedSections: [], failedSections: [], emptySections: [] },
    }
    const removedLayouts: Record<string, LayoutNode<C>> = {}

    for (const sectionLayout of sections) {
      const { key, layout: root, deferred } = sectionLayout
      const bindings = deferred ? undefined : data[key]

      if (bindings === null) {
        result.report.failedSections.push(key)
        continue
      }

      if (!bindings) {
        result.sections.push(sectionLayout)
        continue
      }
      if (typeof bindings !== 'object' || Array.isArray(bindings)) {
        throw new Error(
          `section "${key}": data must be an object { selector: items } (e.g. { card: [...] }), got ${describeValue(bindings)}`
        )
      }

      const definitionOfSection = definitionsByKey.get(key)
      let assigned
      try {
        assigned = assign(root, bindings, { ...options.policies, ...definedOnly(definitionOfSection?.policies) }, { trace })
      } catch (error) {
        throw new Error(`section "${key}": ${(error as Error).message}`, { cause: error })
      }

      result.report.sections[key] = assigned.report

      if (!assigned.layout) {
        result.report.removedSections.push(key)
        if (trace) removedLayouts[key] = root
        continue
      }

      // empty section: no node (or none of `required`) got data
      const { onEmpty = 'remove', required } = definitionOfSection ?? {}
      const candidates = required ? select(assigned.layout, required).map(({ id }) => id) : Object.keys(assigned.data)
      const empty = !candidates.some(id => Object.hasOwn(assigned.data, id))

      if (empty && onEmpty !== 'keep') {
        result.report.emptySections.push(key)

        if (onEmpty === 'error') throw new Error(`section "${key}": no node got data (onEmpty: 'error')`)
        if (trace) removedLayouts[key] = root
        if (onEmpty === 'remove') result.report.removedSections.push(key)
        else result.sections.push({ key, layout: layout(onEmpty, key, { id: options.id, trace, defaults: options.defaults }) })
        continue
      }

      if (empty) result.report.emptySections.push(key)
      Object.assign(result.data, assigned.data)
      result.sections.push({ key, layout: assigned.layout })
    }

    const known = new Set(sections.filter(({ deferred }) => !deferred).map(({ key }) => key))
    result.report.unknownData = Object.keys(data).filter(key => !known.has(key))

    return { result, removedLayouts }
  }

  const withRemoved = (removedLayouts: Record<string, LayoutNode<C>>) =>
    Object.keys(removedLayouts).length ? { removedLayouts } : {}
  const withErrors = (sectionErrors: Record<string, string>) => (Object.keys(sectionErrors).length ? { sectionErrors } : {})

  const cacheKeyFor = (ctx: Ctx) => namespaced(PAGE_NAMESPACE, definition.cache?.key(ctx))

  /** Section data sources and cache key — `report.trace` in debug mode. */
  const traceOf = (ctx: Ctx, definitions: SectionDefinition<C, Ctx>[], data: PageData): PageTrace<C> => {
    const cacheKey = cacheKeyFor(ctx)

    return {
      sources: Object.fromEntries(
        definitions.map(({ key, data: loader, defer }) => [
          key,
          defer ? 'deferred' : loader ? 'section' : Object.hasOwn(data, key) ? 'page' : 'none',
        ])
      ),
      cacheKey: cacheKey ? hashKey(cacheKey) : null,
      ...(definition.cache && { cacheOption: true as const }),
    }
  }

  const build = async (ctx: Ctx, trace = false) => {
    const timer = trace ? createTimer() : undefined
    const definitions = await sectionsFor(ctx)
    const { sections, removedSections, layoutSelectors } = layoutOf(definitions, trace)
    timer?.mark('layout')
    // loaders only for sections present in the layout (not deferred, not removed)
    const present = new Set(sections.filter(({ deferred }) => !deferred).map(({ key }) => key))
    const errors: Record<string, string> = {}
    // debug builds validate the templates against the contract, alongside the loaders
    const [data, templateErrors] = await Promise.all([
      loadWith(ctx, definitions, definitions.filter(({ key }) => present.has(key)), true, trace ? errors : undefined, timer),
      trace ? templateErrorsOf(definitions) : [],
    ])
    timer?.mark('load')
    const { result, removedLayouts } = assignWith(sections, data, definitions, trace)
    timer?.mark('assign')

    result.report.removedSections.unshift(...removedSections)
    if (timer) {
      result.report.trace = {
        ...traceOf(ctx, definitions, data),
        ...withRemoved(removedLayouts),
        ...withErrors(errors),
        ...(layoutSelectors && { layoutSelectors }),
        ...(templateErrors.length && { templateErrors }),
        timing: timer.result('page'),
      }
    }
    return result
  }

  const pageCache = definition.cache && (options.cache ?? createCache())

  return {
    layout: async (ctx, buildOptions = {}) => layoutOf(await sectionsFor(ctx), buildOptions.trace),
    load: async ctx => {
      const definitions = await sectionsFor(ctx)
      return loadWith(ctx, definitions, definitions.filter(({ defer }) => !defer), true)
    },
    assign: async (sections, data, ctx) => assignWith(sections, data, await sectionsFor(ctx)).result,
    // debug mode bypasses the cache: neither reads from nor writes to it
    build: (ctx, buildOptions = {}) =>
      pageCache && !buildOptions.trace
        ? pageCache.fetch(cacheKeyFor(ctx), () => build(ctx), definition.cache)
        : build(ctx, buildOptions.trace),
    async section(key, ctx, buildOptions = {}) {
      const definitions = await sectionsFor(ctx)
      const definitionOfSection = definitions.find(candidate => candidate.key === key)
      if (!definitionOfSection) throw new Error(`page: no section "${key}" for this ctx (sections: ${definitions.map(candidate => candidate.key).join(', ') || 'none'})`)

      const timer = buildOptions.trace ? createTimer() : undefined
      const hits: LayoutSelectorReport[] | undefined = buildOptions.trace ? [] : undefined
      const root = prepare(definitionOfSection, buildOptions.trace, hits)
      timer?.mark('layout')
      const sections = root ? [{ key, layout: root }] : []
      const errors: Record<string, string> = {}
      const [data, templateErrors] = await Promise.all([
        root ? loadWith(ctx, [definitionOfSection], [definitionOfSection], false, buildOptions.trace ? errors : undefined, timer) : {},
        buildOptions.trace ? templateErrorsOf([definitionOfSection]) : [],
      ])
      timer?.mark('load')
      const { result, removedLayouts } = assignWith(sections, data, [definitionOfSection], buildOptions.trace)
      timer?.mark('assign')

      if (!root) result.report.removedSections.push(key)
      if (buildOptions.trace) {
        // a single section is not cached as a page
        const { cacheOption: _pageCache, ...sectionTrace } = traceOf(ctx, [definitionOfSection], data)
        result.report.trace = {
          ...sectionTrace,
          cacheKey: null,
          ...withRemoved(removedLayouts),
          ...withErrors(errors),
          ...(hits?.length && { layoutSelectors: { [key]: hits } }),
          ...(templateErrors.length && { templateErrors }),
          ...(timer && { timing: timer.result(key) }),
        }
      }
      return result
    },
  }
}

const definedOnly = (policies: AssignPolicies = {}): AssignPolicies =>
  Object.fromEntries(Object.entries(policies).filter(([, value]) => value !== undefined))
