import type { Ctx } from '../contract'
import { articles, build, cards, ui } from './shared'
import type { DocCase } from './types'

const { node, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region section-loader
// a shared section with its own loader — added to pages without repeating its data in each page
const header = section('header', node('hero'), {
  data: async () => ({ hero: [(await articles(1))[0]] }),
})

const sectionLoader = ui.page<Ctx>({
  sections: [header, section('news', cards(ui, 'Najnowsze', 3))],
  // page data — for sections without their own loader; loaders run in parallel
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region optional-failed
const optionalFailed = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Najnowsze', 3)),
    section('recommendations', cards(ui, 'Rekomendacje', 3), {
      optional: true, // a loader error removes this section instead of failing the page
      data: async () => {
        throw new Error('recommendations API: 503')
      },
    }),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
  // the error of an optional section — to logs / metrics
  onSectionError: (error, { section }) => console.warn(`[docs] section ${section} failed:`, (error as Error).message),
})
// #endregion

// #region on-empty-remove
const onEmptyRemove = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3)), section('promotions', cards(ui, 'Promocje', 3))],
  // the source returned an empty list — default onEmpty: 'remove' removes the section
  data: async () => ({ news: { card: await articles(3) }, promotions: { card: [] } }),
})
// #endregion

// #region on-empty-keep
const onEmptyKeep = ui.page<Ctx>({
  sections: [
    section('promotions', cards(ui, 'Promocje', 3), {
      onEmpty: 'keep', // the section stays (here with onShortage: 'keep' — empty cards as placeholders)
      policies: { onShortage: 'keep' },
    }),
  ],
  data: async () => ({ promotions: { card: [] } }),
})
// #endregion

// #region on-empty-block
const onEmptyBlock = ui.page<Ctx>({
  sections: [
    section('search', cards(ui, 'Wyniki wyszukiwania', 3), {
      // an empty state instead of the section
      onEmpty: node('section', { props: { title: 'Wyniki wyszukiwania', description: 'Brak wyników dla „Dedal”.' } }),
    }),
  ],
  data: async () => ({ search: { card: [] } }),
})
// #endregion

// #region required
const required = ui.page<Ctx>({
  sections: [
    section('popular', node('section', { children: [node('hero'), cards(ui, 'Popularne', 3)] }), {
      // the hero always gets data — the section counts as empty when no card got any
      required: 'card',
    }),
  ],
  data: async () => {
    const [featured] = await articles(1)
    return { popular: { hero: [featured], card: [] } }
  },
})
// #endregion

// #region defer
const deferred = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Najnowsze', 3)),
    section('forYou', cards(ui, 'Dla Ciebie', 3), {
      // the page result holds only the fallback; the section is built by page.section() in its own request
      defer: { fallback: node('section', { props: { title: 'Dla Ciebie', description: 'Ładowanie rekomendacji…' } }) },
      data: async () => {
        await wait(800) // a slow recommendations API
        return { card: (await articles(6)).slice(3) }
      },
    }),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region unknown-data
const unknownData = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
  // typo in the section key: "newz"
  data: async () => ({ newz: { card: await articles(3) } }),
})
// #endregion

// #region loader-undefined
const loaderUndefined = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Najnowsze', 3), {
      // the loader forgot `return` — TypeScript reports it; the cast simulates plain JS or an `any`-typed API
      data: (async () => {
        await articles(3)
      }) as never,
    }),
  ],
})
// #endregion

export const sectionCases: DocCase[] = [
  {
    slug: 'section-loader',
    title: 'Page data and section loaders',
    level: 'ok',
    description:
      'Data przychodzą z `data` strony (`{ kluczSection: bindings }`) albo z loadera section (`section(key, block, { data })`, zwraca bindings tej section). Loader section pozwala dołączać wspólne section (header, footer) do wielu stron bez powtarzania ich data.\n\nWszystkie loadery i `data` strony działają równolegle. Devtools: `source: page` / `source: section` przy każdej section; czasy w *timing*.',
    run: build(ui, sectionLoader),
  },
  {
    slug: 'optional-failed',
    title: 'Optional section that failed',
    level: 'error',
    description:
      'Błąd loadera zwykle przerywa build (zob. *Errors*). `optional: true` usuwa wtedy tylko tę section — reszta strony się buduje. Błąd trafia do `onSectionError` strony (logi, metryki).\n\nDevtools: `✗ recommendations failed — the loader threw "recommendations API: 503"; the section is skipped (optional: true)`; w *timing* loader na czerwono.',
    run: build(ui, optionalFailed),
  },
  {
    slug: 'on-empty-remove',
    title: 'Empty section (remove)',
    level: 'warning',
    description:
      'Section, w której żaden node nie dostał data, jest pusta. Domyślne `onEmpty: "remove"` ją usuwa — np. promocje, gdy żadnych nie ma.\n\nDevtools: `! promotions removed — no node got data (onEmpty: \'remove\')`; `report.emptySections`, `report.removedSections`.',
    run: build(ui, onEmptyRemove),
  },
  {
    slug: 'on-empty-keep',
    title: 'Empty section (keep)',
    level: 'warning',
    description:
      '`onEmpty: "keep"` zostawia pustą section — z samym layoutem. Tu razem z `onShortage: "keep"`, więc card zostają jako puste miejsca.\n\nDevtools: `! promotions empty — no node got data; kept as is (onEmpty: \'keep\')`.',
    run: build(ui, onEmptyKeep),
  },
  {
    slug: 'on-empty-block',
    title: 'Empty section (block)',
    level: 'warning',
    description:
      '`onEmpty` może być blokiem — stan pusty zamiast section, np. „Brak wyników”. `onEmpty: "error"` zamienia pustą section w wyjątek (zob. *Errors*).\n\nDevtools: `! search empty — no node got data; replaced by the onEmpty block`.',
    run: build(ui, onEmptyBlock),
  },
  {
    slug: 'required',
    title: 'required',
    level: 'warning',
    description:
      'Bez `required` section jest pusta, gdy żaden node nie dostał data. Gdy część node dostaje data zawsze (nagłówek, hero), a o sensie section decydują inne — `required: "card"` liczy tylko node pasujące do selectora.\n\nTu hero ma data, ale żadna card — section jest pusta i znika.',
    run: build(ui, required),
  },
  {
    slug: 'defer',
    title: 'Deferred section (streaming)',
    level: 'ok',
    description:
      '`defer: { fallback }` — wynik strony zawiera tylko zaślepkę, loader się nie wykonuje. Treść buduje `page.section(key, ctx)` w osobnym requeście; w Next — async komponent w `<Suspense>`, dostreamowany, gdy wolne API odpowie (tu 800 ms).\n\nPoza cache strony — miejsce na data spersonalizowane. Devtools łączą payload strony i section; w *timing* section ma własny blok.',
    run: build(ui, deferred),
  },
  {
    slug: 'unknown-data',
    title: 'Data for a missing section',
    level: 'warning',
    description:
      'Data pod key, którego nie ma wśród section strony (literówka, section z innego wariantu) — są pomijane, a section, która miała je dostać, nie dostaje nic i renderuje sam layout (bez `onEmpty` — traktowana jak statyczna).\n\nDevtools: `! newz unknownData — data returned for a section that is not on this page … Did you mean: news?`.',
    run: build(ui, unknownData),
  },
  {
    slug: 'loader-undefined',
    title: 'Loader without return',
    level: 'warning',
    description:
      'Loader (albo `data` strony dla tej section) zwrócił `undefined` — section pokazuje sam layout. W TypeScript zgłasza to kompilator; komunikat łapie przypadki z JS albo API typowanym jako `any`. Zwrócenie tablicy zamiast bindings to wyjątek (zob. *Errors*).\n\nDevtools: `! news no data — the section loader returned undefined for this section, so it shows its layout only`.',
    run: build(ui, loaderUndefined),
  },
]
