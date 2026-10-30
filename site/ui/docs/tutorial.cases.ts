import type { BlockDefinition } from 'dedal'
import type { Article } from '@/content/articles'
import type { Contract, Ctx } from '../contract'
import { articles, build, ui } from './shared'
import type { DocCase } from './types'

const { node, repeat, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region tutorial-goal
// the whole loop in three lines — the next steps build `tutorialHome` (step 6) piece by piece
//
// server:    const result = await tutorialHome.build({ device: 'desktop' })   // template + data
//            const page = ui.resolve(result)                                    // plain JSON — what the frontend receives
// frontend:  <Render tree={page} registry={radixThemes} />                     // component name → React component
// #endregion

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

// server:   const page = ui.resolve(await welcome.build(ctx), { ctx })
// frontend: <Render tree={page} registry={radixThemes} />   ← the registry: see "registry (card)" above
// #endregion

// #region tutorial-data
// a block: a section with a grid of three cards — no texts, data will fill the cards
const latest = node('section', {
  props: { title: 'Latest' },
  // repeat: one card definition, three nodes (each with its own ID)
  children: [node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] })],
})

const withData = ui.page<Ctx>({
  sections: [section('news', latest)],
  // page data: section key → bindings { selector: items }
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region tutorial-template-as-data
// a template store — in a real project a database, a CMS or a design-tool export; here JSON in memory.
// The editors saved version 2 of "latest": a new heading, two columns, four cards.
const storage = new Map<string, string>([
  [
    'latest',
    `{
      "version": 2,
      "block": {
        "component": "section",
        "props": { "title": "Today" },
        "children": [
          { "component": "grid", "props": { "columns": 2 }, "children": [
            { "component": "card", "repeat": 4, "props": { "size": "md" } }
          ] }
        ]
      }
    }`,
  ],
])

// the contract is types only — a template from outside the code is checked at runtime
const components = {
  container: 1, section: 1, grid: 1, flex: 1, hero: 1, card: 1, badge: 1, avatar: 1,
  button: 1, image: 1, tabs: 1, list: 1, separator: 1,
} satisfies Record<keyof Contract, 1>

function validate(block: unknown, path: string): asserts block is BlockDefinition<Contract> {
  const { component, slots, children } = (block ?? {}) as { component?: string; slots?: Record<string, unknown>; children?: unknown[] }
  if (!component || !(component in components)) throw new Error(`template ${path}: unknown component ${JSON.stringify(component)}`)
  for (const [name, content] of Object.entries(slots ?? {})) [content].flat().forEach((child, i) => validate(child, `${path}:${name}.${i}`))
  children?.forEach((child, i) => validate(child, `${path}.${i}`))
}

async function loadTemplate(name: string) {
  const { version, block } = JSON.parse(storage.get(name)!) as { version: number; block: unknown }
  validate(block, name)
  return { version, block }
}

// the page is created per request from the current template; its version goes into the cache key,
// so a new version is served right away instead of waiting for the old entry to go stale
async function latestPage() {
  const template = await loadTemplate('latest')
  return ui.page<Ctx>({
    sections: [section('news', template.block)],
    data: async () => ({ news: { card: await articles(4) } }),
    cache: { key: ctx => ['latest', template.version, ctx.device] },
  })
}
// #endregion

// #region tutorial-slots
// a parametrised block: title, number of cards, columns; every card has two slots — badge and footer
export const cards = (title: string, count: number, columns: 1 | 2 | 3 | 4 = 3) =>
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
export const newsData = (list: Article[]) => ({
  card: list,
  'card > :slot(badge)': list.map(article => article.category),
  'card > :slot(footer)': list.map(article => article.author),
})

const withSlots = ui.page<Ctx>({
  sections: [section('news', cards('Latest', 3))],
  data: async () => ({ news: newsData(await articles(3)) }),
})
// #endregion

// #region tutorial-variants
export const heroBlock = node('hero', { slots: { media: node('image'), actions: [node('button')] } })

export const heroData = (featured: Article) => ({
  hero: [featured],
  image: [featured],
  'hero > :slot(actions)': [{ label: 'Read', href: `/article/${featured.slug}` }],
})

const tutorialHome = ui.page<Ctx>({
  // sections depend on ctx — one template set, a version per device
  sections: ({ device }) => [
    section('hero', heroBlock),
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
    return {
      hero: heroData(list[0]),
      news: newsData(list.slice(1, 4)),
      more: { card: list.slice(4), 'card > :slot(badge)': list.slice(4).map(article => article.category) },
    }
  },
})
// #endregion

// #region tutorial-missing-data
const withMissingData = ui.page<Ctx>({
  sections: ({ device }) => [
    section('hero', heroBlock),
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
  data: async () => {
    const list = await articles(4)
    return { hero: heroData(list[0]), news: newsData(list.slice(1)), promotions: { card: [] } }
  },
  onSectionError: (error, { section }) => console.warn(`[tutorial] ${section}:`, (error as Error).message),
})
// #endregion

// #region tutorial-debugging
// the tutorial page — with five mistakes hidden in it
const latestTwelve = ui.query({ key: () => ['tutorial', 'articles', 12], fn: () => articles(12), staleTime: 60_000 })

const debugging = ui.page<Ctx>({
  sections: ({ device }) => [
    section('hero', heroBlock, { data: async () => heroData((await latestTwelve())[0]) }),
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
    slug: 'tutorial-goal',
    title: '1. Where we are going',
    level: 'ok',
    description: `By the end of this tutorial you will have the home page below: a featured article, the latest news, a compact "More" section — and a version for mobile. More importantly, you will **change its layout without touching the code** (step 4).

Look at the page as two halves:
- the **server** keeps the templates and loads the data, puts them together and sends the frontend a plain JSON description of the page,
- the **frontend** has a catalog of components (the **registry**) and renders whatever description it gets.

This is the JSON the frontend receives for the "Latest" section (abridged):

\`\`\`json
{ "key": "news", "component": "section", "props": { "title": "Latest" }, "children": [
  { "key": "news.0", "component": "grid", "props": { "columns": 3 }, "children": [
    { "key": "news.0.0", "component": "card",
      "props": { "title": "…", "href": "/article/…", "size": "lg" },
      "slots": { "badge": { "component": "badge", "props": { "label": "World" } }, … } },
    …
\`\`\`

The frontend doesn't know it is rendering a home page or where the articles came from. Change this JSON on the server — a different heading, two columns, another section — and the page changes; the frontend stays as it is.`,
    run: async () => build(ui, tutorialHome)(),
  },
  {
    slug: 'tutorial-contract',
    title: '2. Contract and registry',
    level: 'ok',
    files: [
      { title: 'contract', file: 'ui/contract.ts' },
      { title: 'registry (card)', file: 'ui/registries/radix-themes.tsx', region: 'card' },
    ],
    description: `The two halves agree on one thing: the **contract** — a TypeScript type listing which components a page can use and what props they take. It is the only code the server and the frontend share.

- \`card: { title: string; href: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }\` — the card's props; \`Slot\` is a place for another component (a badge, an avatar),
- the values are neutral (\`sm | md | lg\`), not taken from a specific library — each frontend translates them its own way,
- \`Ctx\` — the request context (here \`device\`) that pages can depend on.

The **registry** is the frontend's half: component name → its component. Above is the card in Radix Themes — it gets the contract's props and its slots as ready React elements. \`satisfies Registry<Contract>\` makes a missing component or a wrong prop a compile error. A different frontend (shadcn/ui, Web Components, a mobile app) has a different registry for the same contract.

Below, the smallest page: one section with one node. The server builds it, \`resolve\` turns it into the JSON from step 1, and \`<Render>\` draws it with the registry.`,
    run: build(ui, welcome),
  },
  {
    slug: 'tutorial-data',
    title: '3. A block and its data',
    level: 'ok',
    files: [{ title: 'instance', file: 'ui/dedal.ts' }],
    description: `The **instance** (\`createDedal<Contract>(options)\`, above) is created once per project and gives you \`node\`, \`repeat\`, \`section\`, \`page\`, \`resolve\`.

A **block** is a piece of layout: \`node(component, { props, children, slots })\`. \`repeat(node, 3)\` turns one card definition into three cards. The block has no texts — data fills them.

Data comes from the page's \`data\`, a plain async function where you call your API. Its shape is \`{ sectionKey: { selector: items } }\`, and each entry is a **binding**: the selector \`card\` picks the cards in the \`news\` section, and consecutive articles go to consecutive cards.

Why a selector, and not just a list in order? Because the template will change — a heading gets added, a second grid appears — and \`card\` still hits the cards, wherever they are. That matters a lot in the next step, where someone else edits the template.`,
    run: build(ui, withData),
  },
  {
    slug: 'tutorial-template-as-data',
    title: '4. The template as data',
    level: 'ok',
    description: `So far the template was TypeScript code: changing it means a code change and a release. Now the same kind of block lives **outside the code** — in a database, a CMS, or as an export from a design tool. \`node()\` only builds an object like \`{ component: 'card', props: { … } }\`, so a template can be plain JSON.

Here the editors saved version 2 of the "latest" template — a new heading, two columns, four cards:

\`\`\`
version 1 (step 3)                          version 2 (stored)
"title": "Latest"                     →     "title": "Today"
"columns": 3                          →     "columns": 2
"card" × 3                            →     "card" × 4
\`\`\`

The page below is built from version 2 — **the page code didn't change**, and neither did the data loader: the \`card\` binding finds the cards no matter how many there are or where they sit.

Three things to get right when templates come from outside the code:
- **Validate them.** The contract is types only, so a stored template isn't checked by the compiler. \`validate()\` checks component names when the template is loaded — a typo fails loudly, instead of rendering the registry's fallback.
- **Create the page per request** from the current template. Creating a page is cheap; the cache lives in the instance, not in the page object.
- **Put the template version in the cache key** (\`['latest', template.version, device]\`) — a new version is served on the next request, without waiting for the cached page to go stale.

One difference from code: \`defaults\` from the instance options are added by \`node()\`, so a JSON template carries its props itself (\`"size": "md"\`).

This is the core of server-driven UI: editors and designers change pages, developers change components.`,
    run: async () => build(ui, await latestPage())(),
  },
  {
    slug: 'tutorial-slots',
    title: '5. Slots and toProps',
    level: 'ok',
    files: [{ title: 'toProps', file: 'ui/to-props.ts' }],
    description: `In the contract a card has two **slots**, \`badge\` and \`footer\` — places for other components. The template decides what goes into them (here a \`badge\` and an \`avatar\`), and data reaches them with the \`:slot(name)\` selector: \`card > :slot(badge)\` is the badge in every card. Data is prepared **per component**: articles for cards, categories for badges, authors for avatars — \`newsData(list)\` assembles the bindings.

An article from the API has \`headline\`, \`slug\`, \`cover\`, while the card wants \`title\`, \`href\`, \`image\`. **toProps** (above) translates, per component:
- it gets the props from the template and the node's data; its result is the final props — hence \`...props\`,
- it is also called for nodes without data (\`data: undefined\`) — hence the \`data ? … : props\` condition,
- it has no IO, so it can run on the server or on the frontend.

The block is now a function \`cards(title, count, columns)\` — the next step uses it for two sections.`,
    run: build(ui, withSlots),
  },
  {
    slug: 'tutorial-variants',
    title: '6. Variants: ctx, patch and remove',
    level: 'ok',
    description: `One page, several versions. \`sections\` can be a function of \`ctx\`: on \`mobile\` the grids have fewer columns. This step is rendered with \`device: "mobile"\` — compare it with step 1, which is the same page on desktop.

When a section needs a block that's "almost the same", it adjusts it instead of copying it:
- \`patch: { 'card:first-child': { size: 'lg' } }\` — the first card is featured (desktop only),
- \`remove: 'card > :slot(footer)'\` + \`patch: { card: { size: 'sm' } }\` — "More" is the same \`cards\` block in a compact version.

Selectors use CSS syntax (\`:first-child\`, \`>\`, \`:slot()\`, \`#alias\`, \`[size=lg]\`) — the same in patch, remove, bindings and devtools. The same mechanism serves A/B tests, language versions and per-site layouts — and the frontend knows nothing about any of them.`,
    run: build(ui, tutorialHome, { device: 'mobile' }),
  },
  {
    slug: 'tutorial-missing-data',
    title: '7. When data is missing',
    level: 'error',
    description: `A real API is sometimes empty or down — and with templates edited by other people, the number of places rarely matches the number of articles. Dedal makes you decide explicitly what happens:

- **promotions** — the source returns an empty list; a section in which no node got data disappears by default (\`onEmpty: 'remove'\`),
- **recommendations** — the API throws; \`optional: true\` removes only this section, and the error goes to \`onSectionError\` (logs). Without \`optional\` the whole build would fail,
- fewer articles than cards — the extra cards disappear (\`onShortage: 'remove'\`); more articles than cards — the surplus is skipped.

The page renders, and devtools tell you what disappeared and why — the first step where the panel shows an error and a warning.

That's the whole model. What's left before production — shared sections with their own loaders, streaming of slow sections, cache — is in *Going to production*. First, an exercise.`,
    run: build(ui, withMissingData),
  },
  {
    slug: 'tutorial-debugging',
    title: '8. Debugging',
    level: 'error',
    codeCollapsed: true,
    description: `You get a report from the editors: "the home page looks almost right, but something is off". It's the tutorial's page, grown a bit — with five mistakes of the kind that happen in a real project. Nothing throws an exception and the page renders — the problems only show when you look closely.

Find the causes with the **devtools panel** (the **dedal** button with the logo in the bottom-right corner, or \`Alt+Shift+S\`) before you look at the code — the code is below, collapsed. Each task is a symptom, a hint about where to look, and a solution you can expand.

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
- caching the whole page (\`page({ cache })\`) — in production a slow build only happens after the entry expires.

All three are described in *Going to production*.`,
      },
    ],
    run: build(ui, debugging),
  },
]
