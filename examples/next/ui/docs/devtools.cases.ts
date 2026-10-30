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
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
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
    section('news', cards(ui, 'Najnowsze', 3)),
    section('related', cards(ui, 'Powiązane', 3), {
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
      local.section('sequential', cards(local, 'Po kolei (await, await)', 3), {
        data: async () => {
          const latest = await latestA() // the second query starts only after the first one ends
          const popular = await popularA()
          return { card: [...latest.slice(0, 2), popular[2]] }
        },
      }),
      local.section('parallel', cards(local, 'Równolegle (Promise.all)', 3), {
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
      'Każda strona tych docs ma włączony tryb debug — przycisk **dedal** w prawym dolnym rogu (albo `Alt+Shift+S`) otwiera panel:\n\n- *node* — `pick` i kliknij element strony: component, ID, section, sugerowany selector (`copy`), data i binding, który je przypisał, props z pochodzeniem\n- *tree* — drzewo section; pole wyszukiwania: selector, ID, key section albo tekst z data\n- *sections* — komunikaty strony i section, bindings (`X data items for Y nodes`), problemy z wyjaśnieniem\n- *timing* — czasy builda, loadery na osi czasu, query ze statusem cache\n- `copy report` — raport tekstowy (ten sam co „devtools report” niżej)\n\nTryb debug włącza aplikacja (query param, cookie) — payload zawiera data strony, więc na produkcji tylko świadomie.',
    run: build(ui, panel),
  },
  {
    slug: 'timing',
    title: 'Timing',
    level: 'ok',
    description:
      'Zakładka *timing* (i sekcja „timing” w raporcie) mierzy build w trybie debug: z czego składa się czas (`layout` / `data loading` / `assign`), loadery na osi czasu builda i query pod loaderem, który je wywołał. Wszystkie liczby to ms od początku tego builda.\n\nLoadery startują razem i działają równolegle, więc data loading trwa tyle, co najwolniejszy (`slowest`), a nie tyle, co ich suma. Tu `related` (150 ms) wyznacza czas całej strony; `header` (40 ms) i `page data` (~20 ms) kończą się wcześniej i nic by nie dało ich przyspieszanie.\n\nSzczegóły — skąd biorą się liczby, co znaczą statusy query, czego pomiar nie obejmuje — na stronie grupy *Devtools*.',
    run: build(ui, timing),
  },
  {
    slug: 'timing-sequential',
    title: 'Timing: sequential vs parallel queries',
    level: 'ok',
    description:
      'Dwa loadery pobierają po dwa niezależne źródła (każde ~100 ms: 80 ms opóźnienia + mock API). `sequential` robi to po kolei — `await`, potem `await` — więc drugie query startuje dopiero, gdy pierwsze się skończy, a loader trwa ~200 ms. `parallel` używa `Promise.all` — oba query startują razem, loader trwa ~100 ms.\n\nW *timing* widać to po kolumnie startu query (ms od początku builda): w `sequential` start drugiego ≈ koniec pierwszego, w `parallel` starty są równe. Data loading trwa tyle, co wolniejszy loader — tu `sequential`.',
    run: timingSequential,
  },
  {
    slug: 'no-trace',
    title: 'Build without trace',
    level: 'ok',
    description:
      'Bez `trace` wynik i raport są takie jak na produkcji: brak pochodzenia props, liczby items, unmatched bindings, section usuniętych przez data i czasów. Devtools mówią to wprost: `· built without trace — …; use build(ctx, { trace: true }) and resolve(result, { trace: true })`.\n\nTrace omija cache strony i kosztuje (`inspect()` to kilka ms i 150–250 KB payloadu na ~500 node) — tylko w trybie debug.',
    run: noTrace,
  },
]
