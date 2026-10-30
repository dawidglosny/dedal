import type { Article } from '@/content/articles'
import type { Ctx } from '../contract'
import { articles, build, ui } from './shared'
import type { DocCase } from './types'

const { node, repeat, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region tutorial-contract
// a page with one static section — layout only, no data yet
const welcome = ui.page<Ctx>({
  sections: [
    section(
      'welcome',
      node('section', { props: { title: 'Welcome to Dedal', description: 'This section is a single node with props — matching the contract.' } })
    ),
  ],
})
// #endregion

// #region tutorial-first-block
// a block: a section with a grid of three cards — a plain value, reusable in any page
const staticNews = node('section', {
  props: { title: 'Latest' },
  children: [
    node('grid', {
      props: { columns: 3 },
      // repeat: one card definition, three nodes (each with its own ID)
      children: [repeat(node('card', { props: { title: 'Article title', href: '#' } }), 3)],
    }),
  ],
})

const firstBlock = ui.page<Ctx>({ sections: [section('news', staticNews)] })
// #endregion

// #region tutorial-data
// the same block without fixed texts — data will fill the cards
const latest = node('section', {
  props: { title: 'Latest' },
  children: [node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] })],
})

const withData = ui.page<Ctx>({
  sections: [section('news', latest)],
  // page data: section key → bindings { selector: items }
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region tutorial-to-props
// the page from the previous step — nothing changes here:
// cards get `title`, `href`, `description`, `image` from toProps (ui/to-props.ts) and `size: "md"` from defaults (ui/dedal.ts)
const toPropsStep = withData
// #endregion

// #region tutorial-slots
// a parametrised block: title, number of cards, columns; every card has two slots — badge and footer
const cards = (title: string, count: number, columns: 1 | 2 | 3 | 4 = 3) =>
  node('section', {
    props: { title },
    children: [
      node('grid', {
        props: { columns },
        children: [repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), count)],
      }),
    ],
  })

// data per component: articles for cards, categories for badges, authors for footers
const newsData = (list: Article[]) => ({
  card: list,
  'card > :slot(badge)': list.map(article => article.category),
  'card > :slot(footer)': list.map(article => article.author),
})

const withSlots = ui.page<Ctx>({
  sections: [section('news', cards('Latest', 3))],
  data: async () => ({ news: newsData(await articles(3)) }),
})
// #endregion

// #region tutorial-shared-section
// a shared section with its own loader — define once, add to any page
const hero = section('hero', node('hero', { slots: { media: node('image'), actions: [node('button')] } }), {
  data: async () => {
    const [featured] = await articles(1)
    return {
      hero: [featured],
      image: [featured],
      'hero > :slot(actions)': [{ label: 'Read', href: `/article/${featured.slug}` }],
    }
  },
})

const withHero = ui.page<Ctx>({
  sections: [hero, section('news', cards('Latest', 3))],
  // page data covers the other sections; both loaders run in parallel
  data: async () => ({ news: newsData((await articles(4)).slice(1)) }),
})
// #endregion

// #region tutorial-variants
const withVariants = ui.page<Ctx>({
  // sections depend on ctx: on mobile one column and two cards
  sections: ({ device }) => [
    hero,
    section('news', device === 'mobile' ? cards('Latest', 2, 1) : cards('Latest', 3)),
  ],
  data: async ({ device }) => ({ news: newsData((await articles(device === 'mobile' ? 3 : 4)).slice(1)) }),
})
// #endregion

// #region tutorial-patch-remove
const withPatches = ui.page<Ctx>({
  sections: ({ device }) => [
    hero,
    section(
      'news',
      cards('Latest', 3, device === 'mobile' ? 1 : 3),
      // the first card featured (two columns wide) — only where the grid has room for it
      device === 'desktop' ? { patch: { 'card:first-child': { size: 'lg' } } } : {}
    ),
    section('more', cards('More', 4, device === 'mobile' ? 2 : 4), {
      // the same block in a compact version: no author footer, small cards
      remove: 'card > :slot(footer)',
      patch: { card: { size: 'sm' } },
    }),
  ],
  data: async () => {
    const list = await articles(8)
    return { news: newsData(list.slice(1, 4)), more: { card: list.slice(4), 'card > :slot(badge)': list.slice(4).map(article => article.category) } }
  },
})
// #endregion

// #region tutorial-missing-data
const withMissingData = ui.page<Ctx>({
  sections: ({ device }) => [
    hero,
    section('news', cards('Latest', 3, device === 'mobile' ? 1 : 3)),
    // no active promotions → the section disappears (default onEmpty: 'remove')
    section('promotions', cards('Promotions', 3)),
    section('recommendations', cards('Recommended', 3), {
      optional: true, // the recommendations API failing must not take the whole page down
      data: async () => {
        throw new Error('recommendations API: 503')
      },
    }),
  ],
  data: async () => ({ news: newsData((await articles(4)).slice(1)), promotions: { card: [] } }),
  onSectionError: (error, { section }) => console.warn(`[tutorial] ${section}:`, (error as Error).message),
})
// #endregion

// #region tutorial-defer
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

// #region tutorial-queries-cache
// a query: articles fetched once per key and shared by every loader (and every request, for staleTime)
const latestArticles = ui.query({ key: (count: number) => ['tutorial', 'articles', count], fn: articles, staleTime: 60_000 })

const heroFromQuery = section('hero', node('hero', { slots: { media: node('image'), actions: [node('button')] } }), {
  data: async () => {
    const [featured] = await latestArticles(8) // the same query as the page data below — fetched once
    return { hero: [featured], image: [featured], 'hero > :slot(actions)': [{ label: 'Read', href: `/article/${featured.slug}` }] }
  },
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
  cache: { key: ctx => ['tutorial-home', ctx.device] },
})
// #endregion

// #region tutorial-render
// server (React Server Component):
//   const result = await home.build(ctx)                   // layout + data (PageResult, JSON)
//   const resolved = ui.resolve(result, { ctx })            // final props (ResolvedPage, JSON)
//   return <Render tree={resolved} registry={radixThemes} />
//
// debug mode (the app decides when — e.g. ?debug=1 for the team):
//   const result = await home.build(ctx, { trace: true })
//   const resolved = ui.resolve(result, { ctx, trace: true })
//   <Render tree={resolved} registry={radixThemes} debug />
//   <DevtoolsData payload={inspect(result, resolved)} />
//   <Devtools />
const finalPage = home
// #endregion

// #region tutorial-debugging
// the tutorial page — with five mistakes hidden in it
const latestTwelve = ui.query({ key: () => ['tutorial', 'articles', 12], fn: () => articles(12), staleTime: 60_000 })

const debugging = ui.page<Ctx>({
  sections: ({ device }) => [
    heroFromQuery,
    section(
      'news',
      node('section', {
        props: { title: 'Latest' },
        children: [
          node('grid', {
            props: { columns: device === 'mobile' ? 1 : 3 },
            children: [
              node('card', { alias: 'lead', props: { size: 'lg' }, slots: { badge: node('badge'), footer: node('avatar') } }),
              repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), 3),
            ],
          }),
        ],
      })
    ),
    section('promotions', cards('Promotions', 3)),
    section('recommendations', cards('Recommended', 3), {
      optional: true,
      data: async () => {
        throw new Error('recommendations API: 503')
      },
    }),
    section('more', cards('More', 3, device === 'mobile' ? 2 : 3), { remove: 'card > :slot(footer)', patch: { card: { size: 'sm' } } }),
    section('popular', cards('Popular', 3), {
      data: async () => {
        await wait(600) // a slow "most read" service, called on every request
        return newsData((await articles(10)).slice(7))
      },
    }),
  ],
  data: async () => {
    const list = await latestTwelve()
    const lead = list[11] // chosen by the editors: "Last mock article"
    return {
      news: { ...newsData(list.slice(1, 5)), '#lead': [lead] },
      promotion: { card: list.slice(5, 8) },
      more: { card: list.slice(8, 11), 'card > :slot(badges)': list.slice(8, 11).map(article => article.category) },
    }
  },
})
// #endregion

export const tutorialCases: DocCase[] = [
  {
    slug: 'tutorial-contract',
    title: '1. Contract',
    level: 'ok',
    files: [{ title: 'contract', file: 'ui/contract.ts' }],
    description: `We start with the **contract** — a type that describes which components a page can have and what props they take. It is the only thing the server and the frontend must both know.

- \`card: { title: string; href: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }\` — the card's props; \`Slot\` is a place for another component (badge, avatar),
- the values are neutral (\`sm | md | lg\`), not taken from a specific library — each registry (shadcn, Radix, your own DS) translates them in its own way,
- \`Ctx\` — the request context (here \`device\`) that sections and data can depend on.

Below is the first page: one section with one \`section\` node and its props. No data yet — just layout.`,
    run: build(ui, welcome),
  },
  {
    slug: 'tutorial-first-block',
    title: '2. Instance and the first block',
    level: 'ok',
    files: [{ title: 'instance', file: 'ui/dedal.ts' }],
    description: `The **instance** (\`createDedal<Contract>(options)\`) is the entry point: it gives you \`node\`, \`repeat\`, \`section\`, \`page\`, \`query\`, \`resolve\`. You create it once per project (in a module), with default component props and data mappings (more on those in step 4).

A **block** is a tree of nodes: \`node(component, { props, children, slots })\`. \`repeat(node, 3)\` duplicates a node — here one card definition becomes three. A block is a plain value: you can export it, parametrise it and use it in many pages. It doesn't even have to be code — \`node()\` only builds an object like \`{ component: 'card', props: { … } }\`, so a template can just as well be JSON stored in a database or exported from a design tool (\`examples/web-components\` loads one from a file).

Every node gets an ID from its position (\`news.0.0\`, \`news.0.1\`…) — this is how layout meets data.

For now the cards have a hard-coded \`title\` — in the next step data will replace it.`,
    run: build(ui, firstBlock),
  },
  {
    slug: 'tutorial-data',
    title: '3. Page data and bindings',
    level: 'ok',
    description: `The block no longer has texts — data comes from the page's \`data\`. The shape: \`{ sectionKey: { selector: items } }\`. Each entry is a **binding**: the selector \`card\` picks nodes in the \`news\` section, and consecutive articles go to consecutive cards.

Why a selector and not just a list? Because the block can change (a heading gets added, a second grid) — the \`card\` binding still hits the cards, wherever they are.

\`data\` is a plain async function — in it you call an API, a database, anything. Here it's the mock \`articles(3)\`.`,
    run: build(ui, withData),
  },
  {
    slug: 'tutorial-to-props',
    title: '4. toProps and defaults',
    level: 'ok',
    files: [
      { title: 'toProps', file: 'ui/to-props.ts' },
      { title: 'instance options', file: 'ui/dedal.ts' },
    ],
    description: `An article from the API has the fields \`headline\`, \`slug\`, \`cover\` — while the card in the contract wants \`title\`, \`href\`, \`image\`. **toProps** translates between them: a per-component function \`({ props, data }) => props\`.

- it gets the props from the layout and the node's data; its result is the final props — that's why it spreads \`...props\`,
- it is also called for nodes without data (\`data: undefined\`) — hence the \`data ? … : props\` condition,
- it's a pure module without IO: it works on the server and on the frontend.

**defaults** (\`card: { size: 'md' }\`) are default component props — \`node()\` adds them when the block is created. Precedence: \`defaults\` → props from the layout → data.

The page is the same as in step 3 — the only thing that changes is understanding where the cards get \`title\` and \`size\` from.`,
    run: build(ui, toPropsStep),
  },
  {
    slug: 'tutorial-slots',
    title: '5. Slots',
    level: 'ok',
    description: `In the contract, a card has two **slots**: \`badge\` and \`footer\`. In the block we fill them with nodes (\`badge\`, \`avatar\`) — the server decides what goes into a slot.

Data is assigned to slots with the \`:slot(name)\` selector: \`card > :slot(badge)\` is the badge in every card. Data is prepared **per component**: articles for cards, categories for badges, authors for avatars — the \`newsData(list)\` helper assembles them into bindings.

The block is now a function \`cards(title, count, columns)\` — we'll use it for several sections.`,
    run: build(ui, withSlots),
  },
  {
    slug: 'tutorial-shared-section',
    title: '6. A shared section with a loader',
    level: 'ok',
    description: `The hero (a featured article) should appear on many pages. Instead of repeating its data in every page's \`data\`, the section gets **its own loader**: \`section(key, block, { data })\` — it returns bindings for that section only.

You define such a section once (export it from a module) and add it to any page — that's how you do a header, footer or menu. The section loader and the page's \`data\` run **in parallel**.

Page data must not return anything under the key of a section that has a loader — that's an error (it would be unclear which one wins).`,
    run: build(ui, withHero),
  },
  {
    slug: 'tutorial-variants',
    title: '7. Variants (ctx)',
    level: 'ok',
    description: `\`sections\` can be a function of \`ctx\`. Here, on \`mobile\`, the \`news\` section has one column and two cards; \`data\` also gets \`ctx\` and fetches as many articles as needed.

The same mechanism handles A/B tests, language versions, different layouts per site — variants are plain code on the server, and the frontend knows nothing about them.

This step is rendered with \`device: "mobile"\`.`,
    run: build(ui, withVariants, { device: 'mobile' }),
  },
  {
    slug: 'tutorial-patch-remove',
    title: '8. patch and remove',
    level: 'ok',
    description: `You often need a block that's "almost the same". Instead of copying it, the section modifies the block:

- \`patch: { 'card:first-child': { size: 'lg' } }\` — the first card is featured (on desktop only),
- \`remove: 'card > :slot(footer)'\` + \`patch: { card: { size: 'sm' } }\` — the "More" section is the same \`cards\` block in a compact version.

Selectors use CSS syntax (\`:first-child\`, \`>\`, \`:slot()\`, \`#alias\`, \`[size=lg]\`) — the same matcher works in patch, remove, bindings and devtools.`,
    run: build(ui, withPatches),
  },
  {
    slug: 'tutorial-missing-data',
    title: '9. When data is missing',
    level: 'error',
    description: `A real API is sometimes empty or down. Dedal makes you decide explicitly what happens then:

- **promotions** — the source returns an empty list; a section in which no node got data disappears by default (\`onEmpty: 'remove'\`),
- **recommended** — the API throws an error; \`optional: true\` removes only this section, and the error goes to \`onSectionError\` (logs). Without \`optional\` the whole build would fail.

The page renders, and devtools tell you what disappeared and why — this is the first step in which the panel shows an error and a warning.`,
    run: build(ui, withMissingData),
  },
  {
    slug: 'tutorial-defer',
    title: '10. A deferred section (streaming)',
    level: 'ok',
    description: `The "For you" recommendations are slow (800 ms) and personalised. \`defer: { fallback }\` makes the page result contain only a fallback, and the loader doesn't run — the page goes out right away.

The section's content is built by \`page.section('forYou', ctx)\` in a separate request; in Next it's an async component in \`<Suspense>\` — React streams it in when it's ready. A deferred section is also outside the page cache — a good place for per-user data.`,
    run: build(ui, withDeferred),
  },
  {
    slug: 'tutorial-queries-cache',
    title: '11. Queries and cache',
    level: 'ok',
    description: `The hero and the page's \`data\` need the same articles. \`ui.query({ key, fn, staleTime })\` fetches them once per key and shares them — between loaders of the same request and between requests (up to \`staleTime\`).

\`cache: { key: ctx => ['tutorial-home', ctx.device] }\` caches the whole page result per device (stale-while-revalidate). The key must cover everything the sections and data depend on.

Debug mode bypasses the page cache (devtools show a fresh build), but queries still use their cache — *timing* shows which ones are \`hit\` and which are \`miss\`.`,
    run: build(ui, home),
  },
  {
    slug: 'tutorial-render',
    title: '12. Rendering and devtools',
    level: 'ok',
    files: [{ title: 'registry (card)', file: 'ui/registries/radix-themes.tsx', region: 'card' }],
    description: `The last step is the frontend. \`ui.resolve(result)\` combines layout and data into a tree of \`{ component, props, children, slots }\`, and \`<Render tree registry>\` turns it into React.

The **registry** maps component names to library components — above is the card in Radix Themes: it gets props from the contract (\`title\`, \`href\`, \`size\`) and slots as React elements (\`badge\`, \`footer\`). \`satisfies Registry<Contract>\` checks at compile time that the registry has every component.

In debug mode you add \`trace\`, \`<Render debug>\`, \`<DevtoolsData>\` and \`<Devtools />\` — the panel you've been using throughout this tutorial. The finished page from this tutorial is, in practice, the home page of \`examples/next\` (\`/radix\`, \`/shadcn\` — the same page, two registries).

Next: step 13 — a debugging exercise. After that, the *Layout*, *Data*, *Sections*… groups describe each feature separately, and *Errors* covers what to do when the build throws an exception.`,
    run: build(ui, finalPage),
  },
  {
    slug: 'tutorial-debugging',
    title: '13. Debugging',
    level: 'error',
    codeCollapsed: true,
    description: `You get a report from the editors: "the home page looks almost right, but something is off". It's the same page as in the tutorial — with five mistakes of the kind that happen in a real project. Nothing throws an exception and the page renders — the problems only show when you look closely.

Find the causes with the **devtools panel** (the **dedal** button in the bottom-right corner, or \`Alt+Shift+S\`) before you look at the code — the code is below, collapsed. Each task is a symptom, a hint about where to look, and a solution you can expand.

A good order for every report: *sections* (are there warnings and errors) → \`pick\` on the suspicious element → *tree* with search → *timing*, when it's about time. Attach the report from \`copy report\` to the ticket.`,
    tasks: [
      {
        symptom: 'The editors featured the article "Last mock article", but it isn\'t on the page — the big card in "Latest" shows a different article.',
        hint: '*tree* → type "Last mock article" into the search field. Then *sections* → the `news` section.',
        solution: `The search says: \`! not on the page: section news · #lead [0] …\` — the article made it into data but didn't reach any node. In *sections*: \`✗ #lead — 1 data item for 0 nodes\` and \`“#lead” matches nodes already filled by “card”\`.

Cause: the \`card\` binding comes before \`#lead\`, so it takes all cards — including the one with the \`lead\` alias. A node taken by an earlier binding is skipped by the later ones.

Fix — specific bindings before general ones. The featured card also has slots (\`badge\`, \`footer\`), so it gets its own data for them — otherwise \`card > :slot(badge)\` would give it another article's category:

\`\`\`ts
news: {
  '#lead': [lead],
  '#lead > :slot(badge)': [lead.category],
  '#lead > :slot(footer)': [lead.author],
  ...newsData(list.slice(1, 4)), // the three remaining cards
},
\`\`\``,
      },
      {
        symptom: 'In the "More" section the cards have no category (the badges are empty).',
        hint: '*sections* → the `more` section → bindings. Or `pick` on an empty badge.',
        solution: `*sections*: \`✗ card > :slot(badges) — 3 data items for 0 nodes\` and \`No node in this section matches “card > :slot(badges)” … Did you mean: card > :slot(badge)?\`. \`pick\` on a badge shows that it has no data.

Cause: a typo in the slot name — in the contract the slot is called \`badge\`. A selector that matches nothing doesn't throw; the data simply doesn't reach the page.

Fix: \`'card > :slot(badge)'\`. You can check a selector before changing the code: type it into the *tree* field — the panel will show which nodes it hits.`,
      },
      {
        symptom: 'The "Recommended" section is missing.',
        hint: '*sections* → the page messages at the top. Then *timing*.',
        solution: `*sections*: \`✗ recommendations failed — the loader threw "recommendations API: 503"; the section is skipped (optional: true)\`. In *timing* the \`recommendations\` loader is red.

Cause: the recommendations API is down. The section has \`optional: true\`, so it disappeared instead of taking the page down — that's the intended behaviour, but you need to notice it. The error also goes to the page's \`onSectionError\` — hook up logs and alerts there so things like this don't slip by.`,
      },
      {
        symptom: 'The "Promotions" section has empty cards — no titles and no content.',
        hint: '*sections* → the page messages; look at `source` next to the `promotions` section.',
        solution: `*sections*: \`! promotion unknownData — data returned for a section that is not on this page … Did you mean: promotions?\`. The \`promotions\` section has \`source: none\` — it got no data at all, so it renders the layout only.

Cause: a typo in the section key in the page's \`data\` (\`promotion\` instead of \`promotions\`). Data under an unknown key is skipped.

Fix: \`promotions: { card: list.slice(5, 8) }\`. If there really were no promotions, the section with an empty list would disappear by itself (\`onEmpty: 'remove'\`) — empty cards are a sign that the data never arrived at all.`,
      },
      {
        symptom: 'The page loads slowly — over half a second, even though the API responds in ~20 ms.',
        hint: '*timing* → which loader is `slowest`.',
        solution: `*timing*: the \`popular\` loader takes ~600 ms and is marked \`slowest\` — data loading waits for the slowest loader, so the whole page takes as long as it does. There's no query under it — the result isn't cached.

Fixes (pick one):
- a query in the loader: \`const popular = ui.query({ key: () => ['popular'], fn: fetchPopular, staleTime: 60_000 })\` and \`await popular()\` — the slow call happens once a minute instead of on every request,
- \`defer: { fallback }\` — the page goes out right away, and "Popular" arrives via streaming,
- caching the whole page (\`page({ cache })\`) — in production a slow build only happens after the entry expires.`,
      },
    ],
    run: build(ui, debugging),
  },
]
