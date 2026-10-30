import type { Ctx } from '../contract'
import { articles, build, cards, docsUi, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { section } = ui

// #region page-cache
const pageCache = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  data: async () => ({ news: { card: await articles(3) } }),
  // the page result cached by key (stale-while-revalidate; staleTime 5 s, maxAge 5 min — instance defaults)
  cache: { key: ctx => ['docs-page-cache', ctx.device] },
})
// #endregion

// #region cache-key-undefined
const cacheKeyUndefined = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  data: async () => ({ news: { card: await articles(3) } }),
  // undefined key = this ctx is not cached (e.g. a logged-in user)
  cache: { key: ctx => (ctx.device === 'desktop' ? undefined : ['docs-cache-key', ctx.device]) },
})
// #endregion

// #region query-statuses
async function queryStatuses(): Promise<CaseOutput> {
  const local = docsUi() // a fresh instance (empty cache) on every request — the statuses below are always the same
  const fresh = local.query({ key: () => ['fresh'], fn: () => articles(2), staleTime: 60_000 })
  const old = local.query({ key: () => ['old'], fn: () => articles(2), staleTime: 0 }) // stale right after fetching
  const noKey = local.query({ key: () => undefined, fn: () => articles(2) }) // no key = no cache

  const page = local.page<Ctx>({
    sections: [local.section('news', cards(local, 'Latest', 2))],
    data: async () => {
      await fresh() // miss — fetched
      await fresh() // hit — from the cache
      await old() // miss
      await old() // stale — from the cache, refreshed in the background
      return { news: { card: await noKey() } } // bypass
    },
  })
  return build(local, page)()
}
// #endregion

// #region invalidate
async function invalidate(): Promise<CaseOutput> {
  const local = docsUi()
  const latest = local.query({ key: () => ['articles', 'latest'], fn: () => articles(3), staleTime: 60_000 })
  const page = local.page<Ctx>({
    sections: [local.section('news', cards(local, 'Latest', 3))],
    data: async () => ({ news: { card: await latest() } }),
  })

  await page.build({ device: 'desktop' }) // fills the query cache
  await local.invalidate(['articles']) // e.g. after publishing an article (CMS webhook)
  return build(local, page)() // the query is a miss again — fetched fresh
}
// #endregion

export const cacheCases: DocCase[] = [
  {
    slug: 'page-cache',
    title: 'Page cache',
    level: 'ok',
    description:
      '`page({ cache: { key } })` caches the `build` result by key (an array — everything the sections and data depend on). Stale-while-revalidate: up to `staleTime` the result comes from memory; after that the old result is returned right away and refreshed in the background; parallel requests for the same key wait for a single build. The store is in-memory by default and replaceable (e.g. Redis).\n\nDebug mode **bypasses the page cache** — devtools always show a fresh build. Devtools: `· cache key: ["page","docs-page-cache","desktop"] — debug builds bypass the cache`.',
    run: build(ui, pageCache),
  },
  {
    slug: 'cache-key-undefined',
    title: 'Cache key undefined',
    level: 'ok',
    description:
      'A `cache.key` that returns `undefined` disables the cache for that ctx — e.g. for a logged-in user or a personalised page.\n\nDevtools tell this apart from a missing option: `· cache key: none — cache.key returned undefined for this ctx, so the page is not cached` (vs `none — the page has no cache option`).',
    run: build(ui, cacheKeyUndefined),
  },
  {
    slug: 'query-statuses',
    title: 'Queries and cache statuses',
    level: 'ok',
    description:
      '`ui.query({ key, fn, staleTime, maxAge })` — a data source cached in the instance, shared by pages and sections (e.g. a menu fetched once). The result is frozen (read-only).\n\nStatuses (the *timing* tab, under the loader that called the query):\n- `miss` — fetched (not in the cache or expired)\n- `hit` — from the cache\n- `stale` — from the cache, refreshed in the background (`staleTime` has passed, `maxAge` hasn\'t yet)\n- `bypass` — a query without a key, always fetched\n- `error` — `fn` threw\n\nAttributing queries to a loader requires `AsyncLocalStorage` (global in Next).',
    run: queryStatuses,
  },
  {
    slug: 'invalidate',
    title: 'invalidate',
    level: 'ok',
    description:
      '`ui.invalidate(prefix)` removes page and query entries whose key starts with `prefix` from the cache (`[]` — all of them). Here: a build fills the cache, then `invalidate(["articles"])` (e.g. after an article is published), and in the second build the query is a `miss` again.',
    run: invalidate,
  },
]
