import type { Ctx } from '../contract'
import { articles, build, cards, docsUi, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { section } = ui

// #region page-cache
const pageCache = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
  data: async () => ({ news: { card: await articles(3) } }),
  // the page result cached by key (stale-while-revalidate; staleTime 5 s, maxAge 5 min — instance defaults)
  cache: { key: ctx => ['docs-page-cache', ctx.device] },
})
// #endregion

// #region cache-key-undefined
const cacheKeyUndefined = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
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
    sections: [local.section('news', cards(local, 'Najnowsze', 2))],
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
    sections: [local.section('news', cards(local, 'Najnowsze', 3))],
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
      '`page({ cache: { key } })` cache’uje wynik `build` po key (tablica — wszystko, od czego zależą section i data). Stale-while-revalidate: do `staleTime` wynik z pamięci, potem stary wynik od razu i odświeżenie w tle; równoległe requesty o ten sam key czekają na jeden build. Magazyn domyślnie w pamięci, wymienny (np. Redis).\n\nTryb debug **omija cache strony** — devtools zawsze pokazują świeży build. Devtools: `· cache key: ["page","docs-page-cache","desktop"] — debug builds bypass the cache`.',
    run: build(ui, pageCache),
  },
  {
    slug: 'cache-key-undefined',
    title: 'Cache key undefined',
    level: 'ok',
    description:
      '`cache.key` zwracający `undefined` wyłącza cache dla tego ctx — np. dla zalogowanego użytkownika albo spersonalizowanej strony.\n\nDevtools odróżniają to od braku opcji: `· cache key: none — cache.key returned undefined for this ctx, so the page is not cached` (vs `none — the page has no cache option`).',
    run: build(ui, cacheKeyUndefined),
  },
  {
    slug: 'query-statuses',
    title: 'Queries and cache statuses',
    level: 'ok',
    description:
      '`ui.query({ key, fn, staleTime, maxAge })` — źródło data cache’owane w instancji, wspólne dla stron i section (np. menu pobierane raz). Wynik jest zamrożony (tylko do odczytu).\n\nStatusy (zakładka *timing*, pod loaderem, który wywołał query):\n- `miss` — pobrane (brak w cache albo wygasło)\n- `hit` — z cache\n- `stale` — z cache, odświeżane w tle (`staleTime` minął, `maxAge` jeszcze nie)\n- `bypass` — query bez key, pobierane zawsze\n- `error` — `fn` rzuciło\n\nPrzypisanie query do loadera wymaga `AsyncLocalStorage` (w Next globalny).',
    run: queryStatuses,
  },
  {
    slug: 'invalidate',
    title: 'invalidate',
    level: 'ok',
    description:
      '`ui.invalidate(prefix)` usuwa z cache wpisy stron i query o key zaczynającym się od `prefix` (`[]` — wszystkie). Tu: build wypełnia cache, `invalidate(["articles"])` (np. po publikacji artykułu), drugi build — query znów `miss`.',
    run: invalidate,
  },
]
