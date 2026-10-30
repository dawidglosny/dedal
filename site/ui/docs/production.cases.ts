import type { Ctx } from '../contract'
import { articles, build, ui } from './shared'
import { cards, heroBlock, heroData, newsData } from './tutorial.cases'
import type { DocCase } from './types'

const { node, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region production-shared-section
// a shared section with its own loader — define once, add to any page (a header, a footer, a menu)
export const hero = section('hero', heroBlock, {
  data: async () => heroData((await articles(1))[0]),
})

const withSharedHero = ui.page<Ctx>({
  sections: [hero, section('news', cards('Latest', 3))],
  // page data covers the other sections; both loaders run in parallel
  data: async () => ({ news: newsData((await articles(4)).slice(1)) }),
})
// #endregion

// #region production-defer
const withDeferred = ui.page<Ctx>({
  sections: ({ device }) => [
    hero,
    section('news', cards('Latest', 3, device === 'mobile' ? 1 : 3)),
    // slow, personalised recommendations: the page goes out right away with a fallback, the section is streamed later
    section('forYou', cards('For you', 3), {
      defer: { fallback: node('section', { props: { title: 'For you', description: 'Loading recommendations…' } }) },
      data: async () => {
        await wait(800)
        return newsData((await articles(7)).slice(4))
      },
    }),
  ],
  data: async () => ({ news: newsData((await articles(4)).slice(1)) }),
})
// #endregion

// #region production-queries-cache
// a query: articles fetched once per key and shared by every loader (and every request, for staleTime)
const latestArticles = ui.query({ key: (count: number) => ['production', 'articles', count], fn: articles, staleTime: 60_000 })

const heroFromQuery = section('hero', heroBlock, {
  data: async () => heroData((await latestArticles(8))[0]), // the same query as the page data below — fetched once
})

const home = ui.page<Ctx>({
  sections: ({ device }) => [
    heroFromQuery,
    section('news', cards('Latest', 3, device === 'mobile' ? 1 : 3), device === 'desktop' ? { patch: { 'card:first-child': { size: 'lg' } } } : {}),
    section('more', cards('More', 4, device === 'mobile' ? 2 : 4), { remove: 'card > :slot(footer)', patch: { card: { size: 'sm' } } }),
  ],
  data: async () => {
    const list = await latestArticles(8)
    return { news: newsData(list.slice(1, 4)), more: { card: list.slice(4), 'card > :slot(badge)': list.slice(4).map(article => article.category) } }
  },
  // the whole page result cached per device (stale-while-revalidate; debug builds bypass it)
  cache: { key: ctx => ['production-home', ctx.device] },
})
// #endregion

export const productionCases: DocCase[] = [
  {
    slug: 'production-shared-section',
    title: 'A shared section with its own loader',
    level: 'ok',
    description: `The hero should appear on many pages. Instead of repeating its data in every page's \`data\`, the section gets **its own loader**: \`section(key, block, { data })\` — it returns the bindings of that section only.

You define such a section once (export it from a module) and add it to any page — that's how you do a header, a footer or a menu. The section loader and the page's \`data\` run **in parallel**.

Page data must not return anything under the key of a section that has a loader — that's an error (it would be unclear which one wins).`,
    run: build(ui, withSharedHero),
  },
  {
    slug: 'production-defer',
    title: 'A deferred section (streaming)',
    level: 'ok',
    description: `The "For you" recommendations are slow (800 ms) and personalised. \`defer: { fallback }\` makes the page result contain only a fallback, and the section's loader doesn't run — the page goes out right away.

The section's content is built by \`page.section('forYou', ctx)\` in a separate call; in Next it's an async component inside \`<Suspense>\` — React streams it in when it's ready. A deferred section is also outside the page cache — a good place for per-user data.

This site is static, so the section below was built ahead of time and you see the finished content; in a running app (\`examples/next\`, "For you") you see the fallback first.`,
    run: build(ui, withDeferred),
  },
  {
    slug: 'production-queries-cache',
    title: 'Queries and page cache',
    level: 'ok',
    description: `The hero and the page's \`data\` need the same articles. \`ui.query({ key, fn, staleTime })\` fetches them once per key and shares them — between the loaders of one request and between requests (up to \`staleTime\`).

\`cache: { key: ctx => ['production-home', ctx.device] }\` caches the whole page result per device (stale-while-revalidate). The key must cover everything the sections and data depend on — with templates from storage, also the template version (*Tutorial*, step 4).

Debug mode bypasses the page cache (devtools show a fresh build), but queries still use their cache — *timing* shows which ones are \`hit\` and which are \`miss\`. More: *Cache & queries*.`,
    run: build(ui, home),
  },
]
