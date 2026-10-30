import type { Ctx } from '../contract'
import { articles, build, cards, docsUi, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { node, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region panel
// app/…/page.tsx — debug mode is the app's decision (here: always on in the docs)
//   const result = await page.build(ctx, { trace: true })
//   const resolved = ui.resolve(result, { ctx, trace: true })
//   <Render tree={resolved} registry={registry} debug />
//   <DevtoolsData payload={inspect(result, resolved)} />
//   <Devtools />
const panel = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  data: async () => {
    const list = await articles(3)
    return { news: { card: list, 'card > :slot(badge)': list.map(article => article.category) } }
  },
})
// #endregion

// #region timing
const timing = ui.page<Ctx>({
  sections: [
    section('header', node('hero'), {
      data: async () => {
        await wait(40) // a fast shared section
        return { hero: [(await articles(1))[0]] }
      },
    }),
    section('news', cards(ui, 'Latest', 3)),
    section('related', cards(ui, 'Related', 3), {
      data: async () => {
        await wait(150) // the slowest loader — data loading waits for it
        return { card: (await articles(6)).slice(3) }
      },
    }),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region timing-sequential
async function timingSequential(): Promise<CaseOutput> {
  const local = docsUi() // a fresh instance (empty cache) on every request — every query is a miss
  const slow = (name: string) => local.query({ key: () => [name], fn: async () => (await wait(80), articles(3)) })
  const [latestA, popularA, latestB, popularB] = [slow('latest-a'), slow('popular-a'), slow('latest-b'), slow('popular-b')]

  const page = local.page<Ctx>({
    sections: [
      local.section('sequential', cards(local, 'Sequential (await, await)', 3), {
        data: async () => {
          const latest = await latestA() // the second query starts only after the first one ends
          const popular = await popularA()
          return { card: [...latest.slice(0, 2), popular[2]] }
        },
      }),
      local.section('parallel', cards(local, 'Parallel (Promise.all)', 3), {
        data: async () => {
          const [latest, popular] = await Promise.all([latestB(), popularB()]) // both start together
          return { card: [...latest.slice(0, 2), popular[2]] }
        },
      }),
    ],
  })
  return build(local, page)()
}
// #endregion

// #region no-trace
async function noTrace(): Promise<CaseOutput> {
  // a build without trace: what production code returns — devtools have less to show
  return { ui, ctx: { device: 'desktop' }, page: panel, result: await panel.build({ device: 'desktop' }) }
}
// #endregion

export const devtoolsCases: DocCase[] = [
  {
    slug: 'panel',
    title: 'The devtools panel',
    level: 'ok',
    description:
      'Every page of these docs has debug mode on — the **dedal** button with the logo in the bottom-right corner (or `Alt+Shift+S`) opens the panel:\n\n- *node* — `pick` and click an element on the page: component, ID, section, a suggested selector (`copy`), the data and the binding that assigned it, props with their sources\n- *tree* — the section tree; the search field takes a selector, an ID, a section key or text from the data\n- *sections* — page and section messages, bindings (`X data items for Y nodes`), problems with explanations\n- *timing* — build times, loaders on a timeline, queries with their cache status\n- `copy report` — a text report (the same as the "devtools report" below)\n\nDebug mode is turned on by the app (a query param, a cookie) — the payload contains the page data, so in production only do it deliberately.',
    run: build(ui, panel),
  },
  {
    slug: 'timing',
    title: 'Timing',
    level: 'ok',
    description:
      'The *timing* tab (and the "timing" part of the report) measures the build in debug mode: what the time is made of (`layout` / `data loading` / `assign`), the loaders on the build timeline, and queries under the loader that called them. All numbers are ms from the start of this build.\n\nLoaders start together and run in parallel, so data loading takes as long as the slowest one (`slowest`), not as long as their sum. Here `related` (150 ms) sets the time of the whole page; `header` (40 ms) and `page data` (~20 ms) finish earlier, and speeding them up would gain nothing.\n\nDetails — where the numbers come from, what the query statuses mean, what the measurement doesn\'t cover — are on the *Devtools* group page.',
    run: build(ui, timing),
  },
  {
    slug: 'timing-sequential',
    title: 'Timing: sequential vs parallel queries',
    level: 'ok',
    description:
      'Two loaders each fetch two independent sources (each ~100 ms: an 80 ms delay + the mock API). `sequential` does it one after another — `await`, then `await` — so the second query starts only when the first one ends, and the loader takes ~200 ms. `parallel` uses `Promise.all` — both queries start together, and the loader takes ~100 ms.\n\nIn *timing* you can see it in the query start column (ms from the start of the build): in `sequential` the second one starts ≈ when the first ends; in `parallel` the starts are equal. Data loading takes as long as the slower loader — here `sequential`.',
    run: timingSequential,
  },
  {
    slug: 'no-trace',
    title: 'Build without trace',
    level: 'ok',
    description:
      'Without `trace` the result and the report are what production gets: no prop sources, item counts, unmatched bindings, sections removed because of data, or timings. Devtools say so directly: `· built without trace — …; use build(ctx, { trace: true }) and resolve(result, { trace: true })`.\n\nTrace bypasses the page cache and has a cost (`inspect()` takes a few ms and 150–250 KB of payload for ~500 nodes) — debug mode only.',
    run: noTrace,
  },
]
