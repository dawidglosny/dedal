import type { Ctx } from '../contract'
import { articles, build, cards, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { node, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region section-loader
// a shared section with its own loader — added to pages without repeating its data in each page
const header = section('header', node('hero'), {
  data: async () => ({ hero: [(await articles(1))[0]] }),
})

const sectionLoader = ui.page<Ctx>({
  sections: [header, section('news', cards(ui, 'Latest', 3))],
  // page data — for sections without their own loader; loaders run in parallel
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region optional-failed
const optionalFailed = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Latest', 3)),
    section('recommendations', cards(ui, 'Recommendations', 3), {
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
  sections: [section('news', cards(ui, 'Latest', 3)), section('promotions', cards(ui, 'Promotions', 3))],
  // the source returned an empty list — default onEmpty: 'remove' removes the section
  data: async () => ({ news: { card: await articles(3) }, promotions: { card: [] } }),
})
// #endregion

// #region on-empty-keep
const onEmptyKeep = ui.page<Ctx>({
  sections: [
    section('promotions', cards(ui, 'Promotions', 3), {
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
    section('search', cards(ui, 'Search results', 3), {
      // an empty state instead of the section
      onEmpty: node('section', { props: { title: 'Search results', description: 'No results for "Dedal".' } }),
    }),
  ],
  data: async () => ({ search: { card: [] } }),
})
// #endregion

// #region required
const required = ui.page<Ctx>({
  sections: [
    section('popular', node('section', { children: [node('hero'), cards(ui, 'Popular', 3)] }), {
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
    section('news', cards(ui, 'Latest', 3)),
    section('forYou', cards(ui, 'For you', 3), {
      // the page result holds only the fallback — a block like any other, here a skeleton from the contract;
      // the section itself is built by page.section() in its own request
      defer: { fallback: node('skeleton', { props: { label: 'Loading recommendations…', count: 3 } }) },
      data: async () => {
        await wait(800) // a slow recommendations API
        return { card: (await articles(6)).slice(3) }
      },
    }),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region defer-placeholder
// the same page; the frontend renders it without the `deferred` prop:
//   <Render tree={resolved} registry={registry} />
// every deferred section shows its fallback — rendered by the registry, like any node
const placeholderPage = deferred
// #endregion

// #region defer-failures
// a deferred section whose API is down
const recommendations = section('recommended', cards(ui, 'Recommended', 3), {
  defer: { fallback: node('skeleton', { props: { label: 'Loading recommendations…', count: 3 } }) },
  optional: true, // without it, page.section() throws — after the page has already gone out
  data: async () => {
    throw new Error('recommendations API: 503')
  },
})

const withFailingDeferred = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3)), recommendations],
  data: async () => ({ news: { card: await articles(3) } }),
  onSectionError: (error, { section }) => console.warn(`[docs] ${section}:`, (error as Error).message),
})

// the deferred section's own request — what <Suspense> (or your endpoint) gets:
//   await withFailingDeferred.section('recommended', ctx)
//   → { sections: [], report: { failedSections: { recommended: 'recommendations API: 503' } } }
//   → nothing to render: the placeholder is replaced by nothing
// #endregion

// #region defer-endpoint
// without <Suspense> — an SPA, Web Components, a mobile app: the deferred section gets its own endpoint
//
// server: GET /api/pages/home/sections/:key?device=…
//   const ctx = ctxFrom(request)
//   const result = ui.resolve(await home.section(key, ctx), { ctx })
//   return Response.json(result)                  // a ResolvedPage with that one section — or none
//
// client: render the page (deferred sections show their placeholder), then fetch each of them
//   for (const { key, deferred } of page.sections.filter(section => section.deferred)) {
//     const { sections } = await (await fetch(`/api/pages/home/sections/${key}?device=${device}`)).json()
//     sections[0] ? replaceSection(key, sections[0]) : removeSection(key)   // none: failed or empty
//   }
//
// a working version: examples/web-components (src/server.ts, client/main.ts)
const viaEndpoint = deferred
// #endregion

// #region unknown-data
const unknownData = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  // typo in the section key: "newz"
  data: async () => ({ newz: { card: await articles(3) } }),
})
// #endregion

// #region loader-undefined
const loaderUndefined = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Latest', 3), {
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
      'Data comes from the page\'s `data` (`{ sectionKey: bindings }`) or from a section loader (`section(key, block, { data })`, which returns the bindings of that section). A section loader lets you add shared sections (header, footer) to many pages without repeating their data.\n\nAll loaders and the page\'s `data` run in parallel. Devtools: `source: page` / `source: section` next to every section; timings in *timing*.',
    run: build(ui, sectionLoader),
  },
  {
    slug: 'optional-failed',
    title: 'Optional section that failed',
    level: 'error',
    description:
      'A loader error normally aborts the build (see *Errors*). With `optional: true` only this section is removed — the rest of the page gets built. The error goes to the page\'s `onSectionError` (logs, metrics).\n\nDevtools: `✗ recommendations failed — the loader threw "recommendations API: 503"; the section is skipped (optional: true)`; in *timing* the loader is red.',
    run: build(ui, optionalFailed),
  },
  {
    slug: 'on-empty-remove',
    title: 'Empty section (remove)',
    level: 'warning',
    description:
      'A section in which no node got data is empty. The default `onEmpty: "remove"` removes it — e.g. promotions, when there are none.\n\nDevtools: `! promotions removed — no node got data (onEmpty: \'remove\')`; `report.emptySections`, `report.removedSections`.',
    run: build(ui, onEmptyRemove),
  },
  {
    slug: 'on-empty-keep',
    title: 'Empty section (keep)',
    level: 'warning',
    description:
      '`onEmpty: "keep"` keeps the empty section — with its layout only. Here it\'s combined with `onShortage: "keep"`, so the cards stay as empty places.\n\nDevtools: `! promotions empty — no node got data; kept as is (onEmpty: \'keep\')`.',
    run: build(ui, onEmptyKeep),
  },
  {
    slug: 'on-empty-block',
    title: 'Empty section (block)',
    level: 'warning',
    description:
      '`onEmpty` can be a block — an empty state instead of the section, e.g. "No results". `onEmpty: "error"` turns an empty section into an exception (see *Errors*).\n\nDevtools: `! search empty — no node got data; replaced by the onEmpty block`.',
    run: build(ui, onEmptyBlock),
  },
  {
    slug: 'required',
    title: 'required',
    level: 'warning',
    description:
      'Without `required`, a section is empty when no node got data. When some nodes always get data (a heading, a hero) while others decide whether the section makes sense — `required: "card"` counts only the nodes matching the selector.\n\nHere the hero has data, but no card does — the section is empty and disappears.',
    run: build(ui, required),
  },
  {
    slug: 'defer',
    title: 'Deferred section (streaming)',
    level: 'ok',
    description:
      '`defer: { fallback }` — the page result contains only a fallback, and the loader doesn\'t run. The content is built by `page.section(key, ctx)` in a separate request; in Next — an async component in `<Suspense>`, streamed in once the slow API responds (here 800 ms).\n\nOutside the page cache — the place for personalised data. Devtools combine the page and section payloads; in *timing* the section has its own block.',
    run: build(ui, deferred),
  },
  {
    slug: 'defer-placeholder',
    title: 'Deferred: the placeholder',
    level: 'ok',
    placeholderOnly: true,
    description: `What the reader sees before a deferred section arrives — and what the page shows if nothing fetches it.

\`defer.fallback\` is a **block**, like any template: built on the server, part of the page result (and of the page cache), rendered by the frontend's registry. So the placeholder can be anything from the contract — here a \`skeleton\` component that mimics the cards that will replace it. Keep it close to the size of the real section, so the page doesn't jump when the content arrives.

The result below is rendered without the \`deferred\` prop: \`<Render>\` shows the placeholder and nothing more. With \`deferred\` (previous case), the same placeholder goes into \`<Suspense fallback>\` and is replaced by the section once it's built.

Not to be confused with \`<Render fallback>\` — the component for names missing from the registry (*Rendering*).`,
    run: build(ui, placeholderPage),
  },
  {
    slug: 'defer-failures',
    title: 'Deferred: when the section fails or is empty',
    level: 'error',
    description: `A deferred section is built after the page has already gone out, so a failure can't stop the page — but it still has to end somewhere. What \`page.section(key, ctx)\` returns:

- **the loader throws, the section is \`optional\`** — a result with no sections, the error in \`report.failedSections\` and in \`onSectionError\`. Nothing to render: the placeholder disappears. Shown below.
- **the loader throws, the section isn't \`optional\`** — \`page.section()\` throws. In Next the error happens inside an already streamed \`<Suspense>\`, so it goes to the nearest error boundary (\`error.tsx\`); with an endpoint, to its error response.
- **the section is empty** — with \`onEmpty: 'remove'\` (default) a result with no sections, the key in \`report.removedSections\`: the placeholder disappears. \`'keep'\`, a block or \`'error'\` work as for any section.

In practice: make deferred sections \`optional\` — they are usually the "nice to have" part of the page (recommendations, personalised blocks) — and log \`onSectionError\`.`,
    run: async (): Promise<CaseOutput> => {
      const ctx: Ctx = { device: 'desktop' }
      return { ui, page: withFailingDeferred, ctx, result: await withFailingDeferred.section('recommended', ctx, { trace: true }) }
    },
  },
  {
    slug: 'defer-endpoint',
    title: 'Deferred without Suspense',
    level: 'ok',
    placeholderOnly: true,
    description: `\`<Suspense>\` streaming is a React feature. Elsewhere — a single-page app, Web Components, a mobile app, a backend that only serves JSON — a deferred section gets **its own endpoint**: the server calls \`page.section(key, ctx)\` and \`resolve\`, the client renders the page with its placeholders and then fetches each deferred section and swaps it in.

- \`ResolvedPage.sections[i].deferred === true\` marks a placeholder — that's how a custom renderer knows what to fetch,
- the endpoint returns a \`ResolvedPage\` with one section — or with none, when the section failed (\`optional\`) or was empty: then remove the placeholder,
- \`ctx\` travels with the request (query string, headers), so it must be serializable — the same \`ctx\` as for the page,
- the section's own request skips the page cache; cache its data with \`ui.query\` if it's shared, not per user.

The result below is the page as the client first renders it — with the placeholder. \`examples/web-components\` implements the whole loop (\`/api/section\` and the swap in \`client/main.ts\`).`,
    run: build(ui, viaEndpoint),
  },
  {
    slug: 'unknown-data',
    title: 'Data for a missing section',
    level: 'warning',
    description:
      'Data under a key that isn\'t among the page\'s sections (a typo, a section from another variant) is skipped, and the section that was supposed to get it gets nothing and renders its layout only (without `onEmpty` — it\'s treated as static).\n\nDevtools: `! newz unknownData — data returned for a section that is not on this page … Did you mean: news?`.',
    run: build(ui, unknownData),
  },
  {
    slug: 'loader-undefined',
    title: 'Loader without return',
    level: 'warning',
    description:
      'The loader (or the page\'s `data` for this section) returned `undefined` — the section shows its layout only. In TypeScript the compiler reports this; the message catches cases from plain JS or an API typed as `any`. Returning an array instead of bindings is an exception (see *Errors*).\n\nDevtools: `! news no data — the section loader returned undefined for this section, so it shows its layout only`.',
    run: build(ui, loaderUndefined),
  },
]
