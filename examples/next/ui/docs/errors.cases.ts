import type { Ctx } from '../contract'
import { articles, build, cards, docsUi, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { node, repeat, section } = ui

// #region on-shortage-error
const onShortageError = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 4), { policies: { onShortage: 'error' } })],
  // every card is required: 2 articles for 4 cards → exception
  data: async () => ({ news: { card: await articles(2) } }),
})
// #endregion

// #region on-surplus-error
const onSurplusError = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
  // per binding: no data may be lost
  data: async () => ({ news: { card: { items: await articles(5), onSurplus: 'error' } } }),
})
// #endregion

// #region on-empty-error
const onEmptyError = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3), { onEmpty: 'error' })],
  // the page makes no sense without this section
  data: async () => ({ news: { card: [] } }),
})
// #endregion

// #region loader-throws
const loaderThrows = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Najnowsze', 3), {
      // without optional: true a loader error fails the whole build
      data: async () => {
        throw new Error('news API: 500')
      },
    }),
  ],
})
// #endregion

// #region page-data-for-loader-section
const pageDataForLoaderSection = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3), { data: async () => ({ card: await articles(3) }) })],
  // the section has its own loader — page data must not return data for it
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region duplicate-section-key
const duplicateSectionKey = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3)), section('news', cards(ui, 'Też najnowsze', 3))],
})
// #endregion

// #region data-shape
const dataShape = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Najnowsze', 3), {
      // the loader returns the list itself instead of bindings { card: [...] }
      data: (async () => articles(3)) as never,
    }),
  ],
})
// #endregion

// #region binding-shape
const bindingShape = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
  // a binding must be a list (or { items }), not a single object
  data: async () => ({ news: { card: (await articles(1))[0] as never } }),
})
// #endregion

// #region selector-syntax
const selectorSyntax = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3), { patch: { 'card >': { size: 'lg' } } })],
})
// #endregion

// #region repeat-count
async function repeatCount(): Promise<CaseOutput> {
  // repeat(node, n): n must be an integer >= 1
  const block = node('grid', { children: [repeat(node('card'), 0)] })
  return build(ui, ui.page<Ctx>({ sections: [section('news', block)] }))()
}
// #endregion

// #region root-repeat
const rootRepeat = ui.page<Ctx>({
  // a section root is a single node — repeat it inside a container
  sections: [section('news', repeat(node('card'), 3))],
})
// #endregion

// #region single-slot-repeat
const singleSlotRepeat = ui.page<Ctx>({
  // "media" is a single slot (Slot) — several nodes need a list slot (Slot[])
  sections: [section('hero', node('hero', { slots: { media: repeat(node('image'), 2) as never } }))],
})
// #endregion

// #region duplicate-id
async function duplicateId(): Promise<CaseOutput> {
  // a custom ID generator that is not unique (component name only)
  const local = docsUi({ id: ({ component }) => component })
  const page = local.page<Ctx>({ sections: [local.section('news', cards(local, 'Najnowsze', 2))] })
  return build(local, page)()
}
// #endregion

// #region unknown-section
async function unknownSection(): Promise<CaseOutput> {
  const page = ui.page<Ctx>({ sections: [section('news', cards(ui, 'Najnowsze', 3))] })
  // page.section(key) — e.g. a streamed section requested under a wrong key
  await page.section('forYuo', { device: 'desktop' })
  return build(ui, page)()
}
// #endregion

// #region unsupported-version
async function unsupportedVersion(): Promise<CaseOutput> {
  const page = ui.page<Ctx>({ sections: [section('news', cards(ui, 'Najnowsze', 3))] })
  return {
    ...(await build(ui, page)()),
    // a PageResult from a newer server (format version 2) resolved by an older frontend
    beforeResolve: result => ({ ...result, dedal: 2 as never }),
  }
}
// #endregion

// #region cache-times
async function cacheTimes(): Promise<CaseOutput> {
  // staleTime must not exceed maxAge
  const local = docsUi({ cache: { staleTime: 60_000, maxAge: 5_000 } })
  return build(local, local.page<Ctx>({ sections: [] }))()
}
// #endregion

export const errorCases: DocCase[] = [
  {
    slug: 'on-shortage-error',
    title: "onShortage: 'error'",
    level: 'throws',
    description: 'Brak data dla któregokolwiek node trafionego przez binding przerywa build — gdy każde miejsce musi być wypełnione. Komunikat podaje section, binding, liczbę i ID node oraz politykę.',
    run: build(ui, onShortageError),
  },
  {
    slug: 'on-surplus-error',
    title: "onSurplus: 'error'",
    level: 'throws',
    description: 'Data bez node (więcej items niż node) przerywa build — gdy żadne data nie mogą przepaść. Tu ustawione dla jednego bindingu: `{ items, onSurplus: "error" }`.',
    run: build(ui, onSurplusError),
  },
  {
    slug: 'on-empty-error',
    title: "onEmpty: 'error'",
    level: 'throws',
    description: 'Pusta section (żaden node nie dostał data) przerywa build — gdy strona bez niej nie ma sensu.',
    run: build(ui, onEmptyError),
  },
  {
    slug: 'loader-throws',
    title: 'Loader error',
    level: 'throws',
    description: 'Błąd loadera section bez `optional: true` przerywa build; komunikat podaje section i oryginalny błąd (`cause`). Z `optional: true` znika tylko ta section (zob. *Sections*).',
    run: build(ui, loaderThrows),
  },
  {
    slug: 'page-data-for-loader-section',
    title: 'Page data for a section with a loader',
    level: 'throws',
    description: 'Section z własnym loaderem (albo deferred) ładuje data sama — `data` strony nie może zwracać data pod jej key, bo nie wiadomo, które wygrywa.',
    run: build(ui, pageDataForLoaderSection),
  },
  {
    slug: 'duplicate-section-key',
    title: 'Duplicate section key',
    level: 'throws',
    description: 'Key section musi być unikalny na stronie — od niego zależą ID node i przypisanie data.',
    run: build(ui, duplicateSectionKey),
  },
  {
    slug: 'data-shape',
    title: 'Loader returning a list',
    level: 'throws',
    description: 'Loader section zwraca bindings tej section (`{ card: [...] }`), a nie samą listę. Komunikat pokazuje oczekiwany kształt i to, co przyszło.',
    run: build(ui, dataShape),
  },
  {
    slug: 'binding-shape',
    title: 'Binding that is not a list',
    level: 'throws',
    description: 'Binding to lista items (albo `{ items, onShortage, onSurplus }`). Pojedynczy obiekt trzeba owinąć w tablicę.',
    run: build(ui, bindingShape),
  },
  {
    slug: 'selector-syntax',
    title: 'Selector syntax error',
    level: 'throws',
    description: 'Błąd składni selectora w `patch`, `remove` albo bindingu — komunikat podaje section, selector i pozycję.',
    run: build(ui, selectorSyntax),
  },
  {
    slug: 'repeat-count',
    title: 'repeat with a wrong count',
    level: 'throws',
    description: '`repeat(node, n)` wymaga liczby całkowitej `>= 1`. Rzuca już przy tworzeniu bloku.',
    run: repeatCount,
  },
  {
    slug: 'root-repeat',
    title: 'Repeated section root',
    level: 'throws',
    description: 'Korzeń section to jeden node — powtarzane node trzeba umieścić w kontenerze (np. `grid`).',
    run: build(ui, rootRepeat),
  },
  {
    slug: 'single-slot-repeat',
    title: 'repeat in a single slot',
    level: 'throws',
    description: 'Pojedynczy slot (`Slot` w kontrakcie) przyjmuje jeden node. Kilka node wymaga slotu-listy (`Slot[]`). TypeScript to wyłapuje; rzutowanie symuluje kod bez typów.',
    run: build(ui, singleSlotRepeat),
  },
  {
    slug: 'duplicate-id',
    title: 'Duplicate node ID',
    level: 'throws',
    description: 'Własny generator ID (`createDedal({ id })`) musi dawać ID unikalne na całej stronie (wbudowany generator dokłada key section) — od nich zależy przypisanie data. Duplikat w section rzuca wyjątek `layout: duplicate ID …`; duplikat między section — `page: duplicate node ID … in sections … — node IDs must be unique on the page` (bez tego data jednej section nadpisałyby data drugiej). Najprościej: używaj `prefix` (key section) w generatorze.',
    run: duplicateId,
  },
  {
    slug: 'unknown-section',
    title: 'Unknown section in page.section',
    level: 'throws',
    description: '`page.section(key, ctx)` dla key, którego nie ma w tym ctx — komunikat wymienia dostępne section.',
    run: unknownSection,
  },
  {
    slug: 'unsupported-version',
    title: 'Unsupported format version',
    level: 'throws',
    description: '`PageResult` ma wersję formatu (`dedal: 1`). `resolve` odrzuca nieznaną wersję — np. wynik z nowszego serwera na starszym froncie (topologia API → front).',
    run: unsupportedVersion,
  },
  {
    slug: 'cache-times',
    title: 'Wrong cache times',
    level: 'throws',
    description: 'Czasy cache muszą spełniać `0 <= staleTime <= maxAge`. Czasy instancji — rzuca przy tworzeniu instancji; czasy strony albo query — dopiero przy pierwszym użyciu cache: `build` bez `trace` z key różnym od `undefined` albo wywołanie query z key (build z `trace` i key `undefined` omijają cache, więc nie sprawdzają czasów).',
    run: cacheTimes,
  },
]
