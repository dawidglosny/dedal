import type { Ctx } from '../contract'
import { articles, build, cards, docsUi, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { node, repeat, section } = ui

// #region on-shortage-error
const onShortageError = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 4), { policies: { onShortage: 'error' } })],
  // every card is required: 2 articles for 4 cards → exception
  data: async () => ({ news: { card: await articles(2) } }),
})
// #endregion

// #region on-surplus-error
const onSurplusError = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  // per binding: no data may be lost
  data: async () => ({ news: { card: { items: await articles(5), onSurplus: 'error' } } }),
})
// #endregion

// #region on-empty-error
const onEmptyError = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3), { onEmpty: 'error' })],
  // the page makes no sense without this section
  data: async () => ({ news: { card: [] } }),
})
// #endregion

// #region loader-throws
const loaderThrows = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Latest', 3), {
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
  sections: [section('news', cards(ui, 'Latest', 3), { data: async () => ({ card: await articles(3) }) })],
  // the section has its own loader — page data must not return data for it
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region duplicate-section-key
const duplicateSectionKey = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3)), section('news', cards(ui, 'Also latest', 3))],
})
// #endregion

// #region data-shape
const dataShape = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Latest', 3), {
      // the loader returns the list itself instead of bindings { card: [...] }
      data: (async () => articles(3)) as never,
    }),
  ],
})
// #endregion

// #region binding-shape
const bindingShape = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  // a binding must be a list (or { items }), not a single object
  data: async () => ({ news: { card: (await articles(1))[0] as never } }),
})
// #endregion

// #region selector-syntax
const selectorSyntax = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3), { patch: { 'card >': { size: 'lg' } } })],
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
  const page = local.page<Ctx>({ sections: [local.section('news', cards(local, 'Latest', 2))] })
  return build(local, page)()
}
// #endregion

// #region unknown-section
async function unknownSection(): Promise<CaseOutput> {
  const page = ui.page<Ctx>({ sections: [section('news', cards(ui, 'Latest', 3))] })
  // page.section(key) — e.g. a streamed section requested under a wrong key
  await page.section('forYuo', { device: 'desktop' })
  return build(ui, page)()
}
// #endregion

// #region unsupported-version
async function unsupportedVersion(): Promise<CaseOutput> {
  const page = ui.page<Ctx>({ sections: [section('news', cards(ui, 'Latest', 3))] })
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
    description: 'Missing data for any node matched by a binding aborts the build — for when every place must be filled. The message gives the section, the binding, the number and IDs of the nodes, and the policy.',
    run: build(ui, onShortageError),
  },
  {
    slug: 'on-surplus-error',
    title: "onSurplus: 'error'",
    level: 'throws',
    description: 'Data without a node (more items than nodes) aborts the build — for when no data may be lost. Here it\'s set for a single binding: `{ items, onSurplus: "error" }`.',
    run: build(ui, onSurplusError),
  },
  {
    slug: 'on-empty-error',
    title: "onEmpty: 'error'",
    level: 'throws',
    description: 'An empty section (no node got data) aborts the build — for when the page makes no sense without it.',
    run: build(ui, onEmptyError),
  },
  {
    slug: 'loader-throws',
    title: 'Loader error',
    level: 'throws',
    description: 'A section loader error without `optional: true` aborts the build; the message gives the section and the original error (`cause`). With `optional: true` only this section disappears (see *Sections*).',
    run: build(ui, loaderThrows),
  },
  {
    slug: 'page-data-for-loader-section',
    title: 'Page data for a section with a loader',
    level: 'throws',
    description: 'A section with its own loader (or a deferred one) loads its data itself — the page\'s `data` must not return data under its key, because it would be unclear which one wins.',
    run: build(ui, pageDataForLoaderSection),
  },
  {
    slug: 'duplicate-section-key',
    title: 'Duplicate section key',
    level: 'throws',
    description: 'A section key must be unique on the page — node IDs and data assignment depend on it.',
    run: build(ui, duplicateSectionKey),
  },
  {
    slug: 'data-shape',
    title: 'Loader returning a list',
    level: 'throws',
    description: 'A section loader returns the bindings of that section (`{ card: [...] }`), not the list itself. The message shows the expected shape and what arrived.',
    run: build(ui, dataShape),
  },
  {
    slug: 'binding-shape',
    title: 'Binding that is not a list',
    level: 'throws',
    description: 'A binding is a list of items (or `{ items, onShortage, onSurplus }`). A single object has to be wrapped in an array.',
    run: build(ui, bindingShape),
  },
  {
    slug: 'selector-syntax',
    title: 'Selector syntax error',
    level: 'throws',
    description: 'A selector syntax error in `patch`, `remove` or a binding — the message gives the section, the selector and the position.',
    run: build(ui, selectorSyntax),
  },
  {
    slug: 'repeat-count',
    title: 'repeat with a wrong count',
    level: 'throws',
    description: '`repeat(node, n)` requires an integer `>= 1`. It throws as early as when the block is created.',
    run: repeatCount,
  },
  {
    slug: 'root-repeat',
    title: 'Repeated section root',
    level: 'throws',
    description: 'A section root is a single node — repeated nodes have to be placed in a container (e.g. `grid`).',
    run: build(ui, rootRepeat),
  },
  {
    slug: 'single-slot-repeat',
    title: 'repeat in a single slot',
    level: 'throws',
    description: 'A single slot (`Slot` in the contract) takes one node. Several nodes require a list slot (`Slot[]`). TypeScript catches this; the cast simulates untyped code.',
    run: build(ui, singleSlotRepeat),
  },
  {
    slug: 'duplicate-id',
    title: 'Duplicate node ID',
    level: 'throws',
    description: 'A custom ID generator (`createDedal({ id })`) must produce IDs that are unique across the whole page (the built-in generator adds the section key) — data assignment depends on them. A duplicate within a section throws `layout: duplicate ID …`; a duplicate across sections — `page: duplicate node ID … in sections … — node IDs must be unique on the page` (otherwise one section\'s data would overwrite the other\'s). The simplest fix: use `prefix` (the section key) in the generator.',
    run: duplicateId,
  },
  {
    slug: 'unknown-section',
    title: 'Unknown section in page.section',
    level: 'throws',
    description: '`page.section(key, ctx)` for a key that doesn\'t exist in this ctx — the message lists the available sections.',
    run: unknownSection,
  },
  {
    slug: 'unsupported-version',
    title: 'Unsupported format version',
    level: 'throws',
    description: 'A `PageResult` has a format version (`dedal: 1`). `resolve` rejects an unknown version — e.g. a result from a newer server on an older frontend (the API → frontend topology).',
    run: unsupportedVersion,
  },
  {
    slug: 'cache-times',
    title: 'Wrong cache times',
    level: 'throws',
    description: 'Cache times must satisfy `0 <= staleTime <= maxAge`. Instance times — it throws when the instance is created; page or query times — only on the first cache use: a `build` without `trace` with a key other than `undefined`, or a query call with a key (a build with `trace` and an `undefined` key bypass the cache, so they don\'t check the times).',
    run: cacheTimes,
  },
]
