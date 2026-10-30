/**
 * Group pages of the docs: context for someone new — what a part of Dedal is for, how it works, why it is designed
 * this way, how to use it and what to watch out for. English prose, technical names as used in the code.
 */
export const intros = {
  why: `Dedal keeps three things apart that a typical component tree tangles together — **structure, data and components** — and joins them at the last moment. This page explains why that is useful, who it is for and who it isn't for, and how it compares with what you may already use.

## Three things in one place

A screen built from components mixes three different things in the same code:
- **structure** — which blocks, in what order, what goes inside what. Changed by designers, editors, experiments, sometimes other systems.
- **data** — what's in the blocks. Comes from your APIs, databases, the user.
- **components** — what a "card" or a "button" looks like and how it behaves. Owned by the UI team or a component library.

They change at different times, for different reasons, by different people. But when the structure lives in component code (\`<Grid><Card title={…} /> …</Grid>\`), every rearrangement — a new block, a different order, three items instead of four on mobile, an A/B variant — is a code change and a release, made once per frontend.

Dedal keeps them apart:
- **structure** is a template — plain JSON, which can live in code, in a database, or come from Figma (*Templates from Figma*),
- **data** is attached to it by selectors in CSS syntax (\`card\`, \`#featured\`, \`card > :slot(badge)\`) — the way CSS attaches styles to HTML, here it attaches data to the structure,
- **components** are chosen by the frontend's registry: component name → its component.

\`\`\`
structure (template, JSON) ─┐
                            ├─► Dedal ─► screen description (JSON) ─► registry ─► components
data (your APIs) ───────────┘
\`\`\`

So each part can change on its own: a new structure with the same data, the same data in a new structure, the same description rendered by a different set of components.

## The idea: send the screen, not only the data

In **server-driven UI** the server sends a description of the screen — "a \`grid\` with two columns, inside it two \`card\`s with these titles" — and the frontend renders whatever it gets from a catalog of its own components:

\`\`\`
classic
  frontend: <Grid columns={2}><Card title={a.title} /> …</Grid>   ← layout in the frontend code
  API:      [{ title: "First" }, …]                                ← data only

server-driven UI
  server:   { component: "grid", props: { columns: 2 },
              children: [{ component: "card", props: { title: "First" } }, …] }
  frontend: { grid: Grid, card: Card } + <Render tree={…} />      ← a generic renderer
\`\`\`

The frontend has the building blocks; the server sends the instructions. A new layout needs no new blocks. Only a new kind of block (a new component) touches the frontend.

## Who it is for

Not a kind of company or industry, but a property of the UI: **its structure changes on a different schedule, by different people, or comes from a different system than its components**. That property shows up in many places:

- **mobile apps** — a new screen layout without a store release and waiting for users to update,
- **content sites and landing pages** — editors and marketers rearrange sections every day,
- **dashboards** — which widgets, in what order, per role or per customer,
- **onboarding and multi-step flows** — the steps and their order tuned by product, not by code,
- **stores** — campaign pages, category layouts, A/B tests of the page structure,
- **one design system, many products** — templates designed once (even in Figma — *Templates from Figma*) and served to all of them.

## When it doesn't

- **Application UI** — forms, state, interactions (an editor, a checkout). Dedal assembles screens from blocks of a known set; it doesn't manage state.
- **A structure owned by developers that rarely changes** — plain components in your framework are simpler. Dedal adds a contract and a registry; they pay off when non-developers or other systems change pages.
- **Sharing a component library** across apps or frameworks — that's what Web Components or a multi-framework build of your library are for. Dedal doesn't distribute components; it composes pages from the ones you already have.

Note that in a single full-stack app (like \`examples/next\`) a template written in TypeScript is deployed together with the frontend — there's no release to save. What you still get there: typed templates, data placed by selectors, explicit rules for missing data, cache and devtools. The release-free layout changes come when templates are stored outside the code.

## How it compares

Dedal decides **what** is on the page. Your framework and components decide **how** it looks and behaves. It is not a way to distribute components.

- **React Server Components** — about **where** React runs (the server, less JavaScript in the browser). Complementary: Dedal builds the page, a Server Component renders it — that's what these docs and \`examples/next\` do. RSC says nothing about where the layout comes from.
- **Web Components, multi-framework UI libraries** — about **sharing components** across apps and frameworks. A different problem: Dedal doesn't ship components, it uses the ones you have — Web Components included. Custom elements can be the registry, and Dedal slots map onto native \`<slot>\`s (\`examples/web-components\`).
- **Headless CMS, page builders** — editing content, sometimes layouts, in a UI. They can be the source of templates and data; Dedal is the typed engine in between and has no editor of its own.
- **Hand-made JSON and a \`switch\` over components** — the same idea done ad hoc. This is what Dedal replaces.

## What you get

- **Structure is data** — plain JSON templates you can store, version and generate.
- **One typed contract** — a TypeScript type of components and props, shared by the server and every frontend; templates in code and registries are checked at compile time.
- **Data placed by selectors** — \`card\`, \`#featured\`, \`card > :slot(badge)\`: CSS syntax instead of indexes, so adding a heading doesn't shift the data.
- **Explicit rules for missing data** — fewer items than places, a failing API, an empty section: safe defaults, a strict mode when you want it, and a report of everything that was dropped.
- **Variants without copies** — \`patch\` and \`remove\` adapt one template per device, site or experiment.
- **Speed** — page and data-source cache with stale-while-revalidate, loaders in parallel, streaming of slow sections; building a 530-node page takes under a millisecond.
- **Devtools** — click any element on the page and see where each prop came from, which selector placed the data and what went missing.
- **A bonus: no lock-in** — the page is plain JSON and the registry is the only place that knows your components: switching component libraries doesn't touch the pages, and the zero-dependency core works with any renderer.

## Where it came from

Dedal grew out of one instance of the property above: **many content sites on one design system**. Page templates are designed in a design tool, exported, stored on the server and served to the sites, which render them with the design system's components. Nobody writes the layout of a home page by hand — it is data that editors and designers change, while the components change rarely.

Hand-rolled versions of this keep growing the same parts: how the data reaches the right place in the template, what happens when there's less data than places, caching, and finding out why something on the page looks wrong. Dedal is those parts, typed and tested.

Next: *Quick start* — a rendered page in five files; or *Introduction* — how Dedal works, step by step, on a small example.`,

  quickstart: `From nothing to a rendered page in five files. The code on this page is complete — copy it into a TypeScript project and it runs.

## 1. Install

\`\`\`bash
npm i github:dawidglosny/dedal#v0.6.5
\`\`\`

You need Node 20.9+ and TypeScript. For rendering with React (\`dedal/react\`) — React 18+, which your app most likely has already. The core (\`dedal\`) has no dependencies.

## 2. The contract

The contract lists the components a page can use and their props. It is types only, and it is the one thing the server and the frontend share. \`Slot\` marks a place for another component.

\`\`\`ts
// ui/contract.ts
import type { Slot } from 'dedal'

export type Contract = {
  section: { title?: string }
  card: { title?: string; href?: string; badge?: Slot }
  badge: { label?: string }
}
\`\`\`

## 3. A page: structure and data

Create one instance per project. A page has **sections** — each with a template (the structure) — and a \`data\` function that loads data and says where it goes. \`card\` and \`card > :slot(badge)\` are selectors, in CSS syntax: "every card" and "the badge in every card".

\`\`\`ts
// ui/home.ts
import { createDedal } from 'dedal'
import { fetchArticles } from './api'
import type { Contract } from './contract'

// one instance per project
export const ui = createDedal<Contract>()
const { node, repeat, section } = ui

export const home = ui.page({
  // the structure: a section with three cards, each with a badge
  sections: [
    section(
      'news',
      node('section', {
        props: { title: 'Latest' },
        children: [repeat(node('card', { slots: { badge: node('badge') } }), 3)],
      })
    ),
  ],
  // the data: from your API, placed by selectors
  data: async () => {
    const articles = await fetchArticles()
    return {
      news: {
        card: articles.map(article => ({ title: article.title, href: article.url })),
        'card > :slot(badge)': articles.map(article => ({ label: article.category })),
      },
    }
  },
})
\`\`\`

\`fetchArticles\` is your API. To try it right away, a stand-in:

\`\`\`ts
// ui/api.ts
export const fetchArticles = async () => [
  { title: 'Night trains are coming back', url: '/a/night-trains', category: 'Travel' },
  { title: 'A quiet year for comets', url: '/a/comets', category: 'Science' },
  { title: 'Why bread rises', url: '/a/bread', category: 'Food' },
]
\`\`\`

## 4. The registry

On the frontend, each name from the contract gets a component — from any library or your own design system. Slots arrive as props named after the slot (\`badge\`), children from the template as \`children\`. \`satisfies Registry<Contract>\` makes a missing component or a wrong prop a compile error.

\`\`\`tsx
// ui/registry.tsx
import type { Registry } from 'dedal/react'
import type { Contract } from './contract'

export const registry = {
  section: ({ title, children }) => (
    <section>
      <h2>{title}</h2>
      <div className="grid">{children}</div>
    </section>
  ),
  card: ({ title, href, badge }) => (
    <article>
      {badge}
      <a href={href}>{title}</a>
    </article>
  ),
  badge: ({ label }) => <span className="badge">{label}</span>,
} satisfies Registry<Contract>
\`\`\`

## 5. Render

\`home.build()\` loads the data and puts it into the structure; \`ui.resolve()\` turns that into the final props — plain JSON, the description of the page. \`<Render>\` draws it with the registry.

**Next.js** (App Router) — a Server Component:

\`\`\`tsx
// app/page.tsx
import { Render } from 'dedal/react'
import { home, ui } from '@/ui/home'
import { registry } from '@/ui/registry'

export default async function Page() {
  const page = ui.resolve(await home.build())
  return <Render tree={page} registry={registry} />
}
\`\`\`

**Plain Node**, no framework — the same page as HTML:

\`\`\`tsx
// render.tsx
import { Render } from 'dedal/react'
import { renderToString } from 'react-dom/server'
import { home, ui } from './ui/home'
import { registry } from './ui/registry'

const page = ui.resolve(await home.build())
console.log(renderToString(<Render tree={page} registry={registry} />))
\`\`\`

\`\`\`
<section><h2>Latest</h2><div class="grid">
  <article><span class="badge">Travel</span><a href="/a/night-trains">Night trains are coming back</a></article>
  <article><span class="badge">Science</span><a href="/a/comets">A quiet year for comets</a></article>
  <article><span class="badge">Food</span><a href="/a/bread">Why bread rises</a></article>
</div></section>
\`\`\`

**Another frontend** (a mobile app, Web Components, a different framework) — send the description as JSON and render it there with its own registry: \`Response.json(page)\`. \`examples/web-components\` does exactly that.

## What just happened

- The **structure** (a section, three cards, a badge in each) is in the template, not in JSX. Change \`repeat(…, 3)\` to \`4\`, or add a heading — the data still finds the cards.
- The **data** reached its place by selectors, not by position.
- The **components** are only in the registry — swap them for another library, and the page code doesn't change.

## Next steps

- **The template as data** — move the structure out of the code, into JSON stored on the server: *Tutorial*, step 4.
- **See inside** — the devtools panel shows where every prop came from: *Devtools*, "How to enable it".
- **Learn it properly** — *Tutorial*, then *Layout*, *Data*, *Sections*.`,

  guideStorage: `**In short:** keep templates outside the code — in a database, a CMS, a key-value store — and load them per request without hitting the store every time. This guide covers the whole loop: the stored shape, validation, caching, versions, preview and publishing. *Tutorial*, step 4 shows the idea; this is the version for a real project.

## The stored shape

One record per page: a block per section, and a version that changes on every publish. Keep a draft and a published copy, so editors can work without touching the live page.

\`\`\`json
{
  "version": 3,
  "sections": {
    "news": { "component": "section", "props": { "title": "Latest" }, "children": [
      { "component": "card", "repeat": 2, "slots": { "badge": { "component": "badge" } } }
    ] }
  }
}
\`\`\`

## Loading, validating, caching

The contract is types only, so a template from storage isn't checked by the compiler — validate it when it's loaded (and when it's saved, below). Read published templates through \`ui.query\`: they are cached in the instance, refreshed in the background, and one call to \`ui.invalidate\` drops them after a publish.

\`\`\`ts
// templates.ts
import type { BlockDefinition } from 'dedal'
import type { Contract } from './ui/contract'
import { ui } from './ui/home'

// ---- guide 1: templates in storage ----

/** A stored template: one block per section, and a version that changes on every publish. */
export type StoredTemplate = { version: number; sections: Record<string, unknown> }

/** Your storage — a database table, a CMS, a key-value store. */
export interface TemplateStore {
  get(name: string, state: 'published' | 'draft'): Promise<StoredTemplate | undefined>
}

// the contract is types only — the list of names is what runs
const components = { section: 1, card: 1, badge: 1 } satisfies Record<keyof Contract, 1>

/** Checks a template from outside the code; throws with the path of the first bad node. */
export function validate(block: unknown, path: string): asserts block is BlockDefinition<Contract> {
  if (typeof block !== 'object' || block === null) throw new Error(\`\${path}: not an object\`)
  const { component, slots, children } = block as { component?: unknown; slots?: Record<string, unknown>; children?: unknown }
  if (typeof component !== 'string' || !(component in components)) throw new Error(\`\${path}: unknown component \${JSON.stringify(component)}\`)
  if (children !== undefined && !Array.isArray(children)) throw new Error(\`\${path}: children must be an array\`)
  for (const [name, content] of Object.entries(slots ?? {})) [content].flat().forEach((child, i) => validate(child, \`\${path}:\${name}.\${i}\`))
  ;(children as unknown[] | undefined)?.forEach((child, i) => validate(child, \`\${path}.\${i}\`))
}

export function validateTemplate(template: StoredTemplate): Record<string, BlockDefinition<Contract>> {
  for (const [key, block] of Object.entries(template.sections)) validate(block, key)
  return template.sections as Record<string, BlockDefinition<Contract>>
}

export function createTemplates(store: TemplateStore) {
  // published templates are read through a query: cached in the instance, refreshed in the background
  const published = ui.query({
    key: (name: string) => ['template', name],
    fn: async (name: string) => {
      const template = await store.get(name, 'published')
      if (!template) throw new Error(\`template "\${name}" is not published\`)
      return { version: template.version, sections: validateTemplate(template) }
    },
    staleTime: 60_000,
  })

  return {
    published,
    /** Drafts skip the cache — editors see their last save. */
    draft: async (name: string) => {
      const template = await store.get(name, 'draft')
      if (!template) throw new Error(\`template "\${name}" has no draft\`)
      return { version: template.version, sections: validateTemplate(template) }
    },
    /** After publishing: drop the cached template and the pages built from it. */
    onPublish: (name: string) => ui.invalidate(['template', name]),
  }
}
\`\`\`

\`validate\` checks component names and the shape of the tree. If you want to check prop values too, add a schema per component (any validation library) next to the contract — the shape is plain JSON.

## The page per request

Create the page from the current template — creating a page is cheap; the cache lives in the instance. Put the template **version** in the page cache key: a new publish is served right away, without waiting for the old entry to go stale. A preview reads the draft and isn't cached.

\`\`\`ts
/** The page for one request — from the published template, or from the draft for a preview. */
export async function homePage({ preview = false } = {}) {
  const template = preview ? await templates.draft('home') : await templates.published('home')
  return ui.page({
    sections: Object.entries(template.sections).map(([key, block]) => ui.section(key, block)),
    data: async () => {
      const articles = await fetchArticles()
      return {
        news: {
          card: articles.map(article => ({ title: article.title, href: article.url })),
          'card > :slot(badge)': articles.map(article => ({ label: article.category })),
        },
      }
    },
    // the version in the key: a new publish is served right away; previews are never cached
    cache: preview ? undefined : { key: () => ['home', template.version] },
  })
}
\`\`\`

Build a preview with \`{ trace: true }\` and render the devtools panel: editors see where every prop comes from before they publish.

## Publishing

1. The editor (or a design-tool export, see *Templates from Figma*) saves a **draft** — validate it on save and refuse an invalid one.
2. A preview renders the draft.
3. Publishing copies the draft to **published** with a new version, then calls \`templates.onPublish(name)\`.
4. Rollback = publish an older version again.

## Validating in CI

Run the same \`validateTemplate\` over every stored template in CI, and over the templates in your repository if you keep fixtures there — a renamed component in the contract shows up as a failing build, not as an empty spot on the page.

\`\`\`ts
// scripts/validate-templates.ts
for (const name of await store.list()) // your store's list of template names
  validateTemplate((await store.get(name, 'published'))!)
\`\`\`

## What to watch out for

- **The release order:** add a component to every registry before any template uses it — an older frontend renders the registry's \`fallback\` (nothing by default).
- **\`defaults\`** from the instance options are added by \`node()\` — a stored template carries its props itself.
- **Data doesn't care about the template:** the loader places data by selectors (\`card\`), so editors can add, remove and move cards without a code change. Changing the **contract** (a renamed prop, a removed component) is a code change — and a reason to validate stored templates.`,

  guideFigma: `**In short:** design the page in Figma with your design-system components, publish, and get a Dedal template — no hand-written JSON. Dedal has no Figma plugin; what it needs is a naming convention and a small converter over the Figma REST API, shown here in full.

## The convention

Figma already has everything a template needs, if the names line up with the contract:

- **an instance of a design-system component → a node.** The main component's name (or the component set's, for variants) is the contract name: \`card\`, \`badge\`.
- **component properties → props.** Text and boolean properties lose Figma's id suffix (\`title#12:0\` → \`title\`); variant properties keep their name (\`size=md\` → \`size: "md"\`).
- **a layer \`slot:badge\` inside an instance → the slot \`badge\`.** An instance with that name is a single slot; a frame \`slot:actions\` with instances in it is a list slot.
- **a frame named after a contract component → a container node**, with props in the name: \`section title=Latest\`, \`grid columns=3\`. Its layers become children.
- **any other frame or group is only layout in Figma** — its instances go to the parent. Spacing, sizes and colors stay in the components and the design tokens; a template carries structure and props, not pixels.
- **the page frame:** every top-level layer is a section — its name is the section key (\`news\`), its first layer the section root.

Texts typed in Figma become template props. For a heading that is the content; for a card that will get data, it is a placeholder the data replaces.

## The converter

It reads the response of the file nodes endpoint (\`GET /v1/files/:file_key/nodes?ids=<frame id>\`): the frame's \`document\`, plus \`components\` and \`componentSets\` — maps from ids to names. Validation runs on the result, so a component that isn't in the contract fails with the name of the layer.

\`\`\`ts
// figma.ts
import type { BlockDefinition } from 'dedal'
import type { Contract } from './ui/contract'
import { validate } from './templates'

/** The parts of a node from the Figma REST API that the converter reads (GET /v1/files/:key/nodes?ids=…). */
export type FigmaNode = {
  name: string
  type: string // 'FRAME', 'GROUP', 'INSTANCE', 'TEXT', …
  componentId?: string
  componentProperties?: Record<string, { type: 'TEXT' | 'BOOLEAN' | 'VARIANT' | 'INSTANCE_SWAP'; value: string | boolean }>
  children?: FigmaNode[]
}
/** \`components\` and \`componentSets\` from the same response: id → name. */
export type FigmaMeta = {
  components: Record<string, { name: string; componentSetId?: string }>
  componentSets: Record<string, { name: string }>
}

const value = (raw: string) => (raw === 'true' ? true : raw === 'false' ? false : raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw)

/** "grid columns=3 gap=md" → { component: 'grid', props: { columns: 3, gap: 'md' } } */
const parseLayerName = (name: string) => {
  const [component, ...pairs] = name.trim().split(/\\s+/)
  return { component, props: Object.fromEntries(pairs.map(pair => pair.split('=')).map(([key, raw]) => [key, value(raw ?? '')])) }
}

/**
 * A Figma frame → templates, one per section. Conventions:
 * - every top-level layer of the frame is a section; its name is the section key, its first layer the section root,
 * - an instance of a design-system component → a node; the component (or component set) name is the contract name,
 *   its component properties are props ("title#12:0" → "title"; variants as they are),
 * - a frame named after a contract component ("grid columns=3") → a container node; its layers → children,
 * - a layer named "slot:badge" inside an instance → the slot "badge"; a frame "slot:actions" with instances → a list slot,
 * - any other frame or group is only layout in Figma — its instances go to the parent.
 */
export function fromFigma(frame: FigmaNode, meta: FigmaMeta, known: Record<string, unknown>) {
  const nameOf = (node: FigmaNode) => {
    const component = meta.components[node.componentId ?? '']
    return component?.componentSetId ? meta.componentSets[component.componentSetId]?.name : component?.name
  }

  const toBlocks = (node: FigmaNode): unknown[] => {
    if (node.type === 'INSTANCE') {
      const props = Object.fromEntries(
        Object.entries(node.componentProperties ?? {})
          .filter(([, property]) => property.type !== 'INSTANCE_SWAP')
          .map(([key, property]) => [key.split('#')[0], property.value])
      )
      const slots: Record<string, unknown> = {}
      for (const layer of node.children ?? []) {
        if (!layer.name.startsWith('slot:')) continue // the component's own layers stay in the component
        const name = layer.name.slice('slot:'.length)
        slots[name] = layer.type === 'INSTANCE' ? toBlocks({ ...layer, name: '' })[0] : (layer.children ?? []).flatMap(toBlocks)
      }
      const component = nameOf(node)
      if (!component) throw new Error(\`layer "\${node.name}": an instance of a component that isn't in this file's components\`)
      return [{ component, ...(Object.keys(props).length && { props }), ...(Object.keys(slots).length && { slots }) }]
    }
    const { component, props } = parseLayerName(node.name)
    const children = (node.children ?? []).flatMap(toBlocks)
    if (component in known) return [{ component, ...(Object.keys(props).length && { props }), ...(children.length && { children }) }]
    return children // layout only
  }

  const sections: Record<string, BlockDefinition<Contract>> = {}
  for (const layer of frame.children ?? []) {
    const [root] = (layer.children ?? []).flatMap(toBlocks)
    validate(root, layer.name)
    sections[layer.name] = root
  }
  return sections
}
\`\`\`

A "Home" frame with a \`section title=Latest\` frame and three card instances (each with a \`slot:badge\` badge) becomes:

\`\`\`json
{ "news": { "component": "section", "props": { "title": "Latest" }, "children": [
  { "component": "card", "props": { "title": "Article title" },
    "slots": { "badge": { "component": "badge", "props": { "label": "Category" } } } },
  … ] } }
\`\`\`

An instance of a component that isn't in the contract stops the conversion: \`hero: unknown component "Button/Primary"\`.

## From Figma to the page

1. Designers build the page frame with library components and publish.
2. A job — triggered by a Figma webhook, a button in your admin, or a schedule — fetches the frame (\`GET /v1/files/:file_key/nodes?ids=…\` with an access token in \`X-Figma-Token\`) and runs \`fromFigma\`.
3. The result is saved as a **draft** in your template store — the rest is *Templates in a database or CMS*: preview, publish with a new version, \`onPublish\`.

## What to watch out for

- **Names are the contract.** Renaming a component in Figma without renaming it in the contract (or the other way round) fails validation — on purpose. Agree on the names with the design team, like any API.
- **One instance = one node.** The converter doesn't collapse repeated instances into \`repeat\`; that's fine — a template with three \`card\` nodes works the same.
- **Figma's API shape can change** — keep the converter small and covered by a test with a saved response.`,

  guideAdopting: `**In short:** you don't have to rebuild an app to try Dedal. Hand one block of one page over to it, keep your components, and grow from there — or stop, if it doesn't pay off.

## Pick the block

Choose a part of a page whose structure changes more often than its components — a news list, a promotions strip, a set of tiles. Everything else on the page stays as it is.

## 1. A contract for that block only

List just the components the block uses, with the props it needs (*Quick start*, step 2). The contract grows when the next block moves over.

## 2. A registry over the components you already have

The registry doesn't need new components: it adapts the contract to the props of the existing ones. Here an \`ArticleCard\` that takes \`heading\`, \`link\` and \`tag\` serves as the contract's \`card\`:

\`\`\`tsx
import { Render, type Registry } from 'dedal/react'
import type { ReactNode } from 'react'
import type { Contract } from './ui/contract'
import { home, ui } from './ui/home'

// ---- what the app has today ----
function ArticleCard({ heading, link, tag }: { heading: string; link: string; tag?: ReactNode }) {
  return (
    <article className="article-card">
      {tag}
      <a href={link}>{heading}</a>
    </article>
  )
}
const Tag = ({ text }: { text: string }) => <span className="tag">{text}</span>
const Header = () => <header>Site header</header>
const Footer = () => <footer>Site footer</footer>

// ---- the registry adapts the existing components to the contract — nothing is rewritten ----
const registry = {
  section: ({ title, children }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  card: ({ title = '', href = '#', badge }) => <ArticleCard heading={title} link={href} tag={badge} />,
  badge: ({ label = '' }) => <Tag text={label} />,
} satisfies Registry<Contract>

// ---- the page as it was, with one block handed over to Dedal ----
async function HomePage() {
  const news = ui.resolve(await home.build())
  return (
    <>
      <Header />
      {/* was: <LatestNews articles={articles} /> */}
      <Render tree={news} registry={registry} />
      <Footer />
    </>
  )
}
\`\`\`

\`home\` is a page with one section that reproduces the block as it was — the template written from the old JSX, the data from the loader the block used before (*Quick start*, step 3).

## 3. Compare and switch

Render the old block and the new one side by side (a feature flag, a query parameter) until they match — devtools show where every prop came from. Then remove the old block.

## 4. Next blocks — or not

Each next block adds its components to the contract and the registry. Once the structure of a page lives in a template, it can move out of the code (*Templates in a database or CMS*). If after the first block the structure turns out to change rarely, keep the plain component — Dedal pays off where layouts change, not everywhere.

## Without a server framework

The core runs in the browser too. A single-page app can get the page as JSON from any endpoint (\`ui.resolve(await home.build(ctx))\` on the server) and render it with \`<Render>\` — the registry is the same.`,

  guideClients: `**In short:** \`dedal/react\` is one renderer of many possible. The page Dedal produces is plain JSON with a small, fixed shape, and a renderer is a function that walks it — a few dozen lines in any language: a mobile app, Web Components, server-side templates.

## The format

\`ui.resolve()\` returns a \`ResolvedPage\`:

\`\`\`ts
type ResolvedPage = {
  dedal: 1                                              // the format version — check it
  sections: { key: string; tree: ResolvedNode; deferred?: true }[]
  issues: { id: string; message: string }[]             // problems resolve worked around
}

type ResolvedNode = {
  key: string                                           // a stable ID — use it as the key in lists
  component: string                                     // a name from the contract
  props: Record<string, unknown>                       // final props, plain JSON
  slots?: Record<string, ResolvedNode | ResolvedNode[]> // named places: one node or a list
  children?: ResolvedNode[]
}
\`\`\`

Serve it from an endpoint — \`Response.json(ui.resolve(await page.build(ctx), { ctx }))\` — and the client renders it.

## A renderer

Walk the tree: look up the component, render the slots and children first, pass them to it. This one produces HTML strings, with no dependencies:

\`\`\`ts
import type { ResolvedNode, ResolvedPage } from 'dedal'
import type { Contract } from './ui/contract'

// a renderer without React: component name → a function from props, slots and children to HTML
type Html = string
type Renderer = (props: Record<string, any>, slots: Record<string, Html | Html[]>, children: Html[]) => Html

const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, char => \`&#\${char.charCodeAt(0)};\`)

const views: Record<keyof Contract, Renderer> = {
  section: (props, _, children) => \`<section><h2>\${escape(props.title)}</h2>\${children.join('')}</section>\`,
  card: (props, slots) => \`<article>\${slots.badge ?? ''}<a href="\${escape(props.href)}">\${escape(props.title)}</a></article>\`,
  badge: props => \`<span class="badge">\${escape(props.label)}</span>\`,
}

function renderNode(node: ResolvedNode<Contract>): Html {
  const view = views[node.component as keyof Contract]
  if (!view) return '' // an unknown component: render nothing (or a placeholder) — an older client, a newer server
  const slots = Object.fromEntries(
    Object.entries(node.slots ?? {}).map(([name, content]) => [name, Array.isArray(content) ? content.map(renderNode) : renderNode(content)])
  )
  return view(node.props as Record<string, any>, slots, (node.children ?? []).map(renderNode))
}

export const renderPage = (page: ResolvedPage<Contract>) => page.sections.map(({ tree }) => renderNode(tree)).join('\\n')
\`\`\`

The same walk works in Swift or Kotlin (a view per component name), and with Web Components — \`examples/web-components\` renders the tree into custom elements, with Dedal slots mapped onto native \`<slot>\`s.

Three rules every renderer needs:
- **an unknown component** renders nothing or a placeholder — never crashes: the server may know components an older client doesn't,
- **\`deferred: true\`** marks a placeholder of a deferred section: render it, then fetch the section from its own endpoint (*Deferred without Suspense*),
- **\`dedal\`** — refuse a format version you don't know.

## Older clients

A web frontend updates on every deploy; a mobile app doesn't. Let the client say what it supports — an app version in \`ctx\` — and remove what it can't render, in the template rather than in the client:

\`\`\`ts
import { createDedal } from 'dedal'
import type { Contract } from './ui/contract'

const ui = createDedal<Contract>()
const { node, repeat, section } = ui

// the app tells the server what it supports; older versions don't get components they can't render
type Ctx = { appVersion: number }
const BADGES_SINCE = 42 // the app version that added the badge component

const home = ui.page<Ctx>({
  sections: ({ appVersion }) => [
    section('news', node('section', { props: { title: 'Latest' }, children: [repeat(node('card', { slots: { badge: node('badge') } }), 2)] }), {
      remove: appVersion < BADGES_SINCE ? 'badge' : [],
    }),
  ],
  data: async ({ appVersion }) => {
    const articles = [{ title: 'A', href: '/a', category: 'x' }, { title: 'B', href: '/b', category: 'y' }]
    return {
      news: {
        card: articles.map(({ title, href }) => ({ title, href })),
        // no badges in the template for older apps — no badge data either
        ...(appVersion >= BADGES_SINCE && { 'card > :slot(badge)': articles.map(article => ({ label: article.category })) }),
      },
    }
  },
  cache: { key: ctx => ['home', ctx.appVersion >= BADGES_SINCE] },
})
\`\`\`

App 41 gets cards without badges, app 42 with them — and no devtools warnings for either, because the badge data is skipped together with the badges. The app version is in the cache key, so the two variants are cached separately.

## Types on the client

The contract is a TypeScript type. A TypeScript client imports it directly (\`examples/web-components\` does). For Swift or Kotlin, keep the contract as the source of truth and generate the client types from it, or write them by hand next to the registry and check them against stored templates in CI.`,

  guideTesting: `**In short:** most of what can go wrong with a Dedal page is visible without a browser — in the build report, in \`resolve\` issues, in the devtools messages. Put them in tests.

## What to test

- **pages** — they build, every binding finds its nodes, nothing is removed or fails unexpectedly,
- **the registry** — every component a page uses has an implementation,
- **toProps** — plain functions: data in, props out,
- **stored templates** — validated in CI (*Templates in a database or CMS*),
- **the contract** — the type checker: \`satisfies Registry<Contract>\` and typed templates fail the build when they drift apart.

## A page test

With any test runner — here Node's built-in one (\`node --test\`):

\`\`\`tsx
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspect, pageMessages, reportText } from 'dedal/devtools'
import { renderToString } from 'react-dom/server'
import { Render } from 'dedal/react'
import { home, ui } from './ui/home'
import { registry } from './ui/registry'

test('the home page builds without problems', async () => {
  const result = await home.build(undefined, { trace: true })
  const resolved = ui.resolve(result, { onIssue: 'throw' }) // bad data → an exception, not a quiet fallback

  const problems = pageMessages(inspect(result, resolved)).filter(message => message.level !== 'info')
  assert.deepEqual(problems, [], reportText(inspect(result, resolved))) // the report as the failure message

  assert.equal(result.report.removedSections.length, 0)
  assert.equal(Object.keys(result.report.failedSections ?? {}).length, 0)
})

test('every component the page uses is in the registry', async () => {
  const page = ui.resolve(await home.build())
  const missing: string[] = []
  const fallback = ({ component }: { component: string }) => (missing.push(component), null)
  renderToString(<Render tree={page} registry={registry} fallback={fallback} />)
  assert.deepEqual(missing, [])
})

test('a selector typo is reported', async () => {
  const broken = ui.page({
    sections: [ui.section('news', ui.node('section', { children: [ui.node('card', { slots: { badge: ui.node('badge') } })] }))],
    data: async () => ({ news: { card: [{ title: 'a' }], 'card > :slot(badges)': [{ label: 'x' }] } }),
  })
  const result = await broken.build(undefined, { trace: true })
  const errors = pageMessages(inspect(result, ui.resolve(result))).filter(message => message.level === 'error')
  assert.match(errors[0].text, /binding matches no node/)
})
\`\`\`

- \`build(ctx, { trace: true })\` keeps the details the devtools need; \`inspect()\` turns them into a payload, and \`pageMessages()\` into messages — the same ones as the panel's *sections* tab,
- \`resolve(…, { onIssue: 'throw' })\` turns bad data (a \`toProps\` that throws, data that isn't an object) into an exception instead of a quiet fallback,
- \`reportText()\` as the failure message: a failing test prints the whole report — what went where, what got dropped and why,
- a \`fallback\` that records names catches components missing from the registry.

## Data for tests

Point the page's loaders at fixtures — pass the API client in (\`createHomePage(api)\`) or mock the module. Test the edges the page is supposed to survive: an empty list, fewer items than places, a failing optional section — each has a defined outcome (*Data*, *Sections*), so it can be asserted.

## Snapshots

\`reportText(inspect(result, resolved))\` is plain text and stable — a good snapshot. It changes when the structure, the bindings or the data placement change, and the diff says what changed.`,

  introduction: `This page shows how Dedal works: who does what, how data flows from a template to the screen, and a small example followed step by step. The full glossary is on its own page — *Glossary*. Why Dedal exists and when to use it: *Why Dedal*.

## Five words to start with

You need only these to follow the rest of this page (the full glossary is at the end):
- **contract** — a TypeScript type: which components exist and what props they take. The server and the frontend share it.
- **block** — a piece of layout: \`node('card', { props })\`, or the same thing as plain JSON. Structure only, no data.
- **section** — a block placed on a page under a key (\`news\`), together with the rules for its data.
- **binding** — "this data goes to these nodes": \`{ card: articles }\`. The key is a selector in CSS syntax.
- **registry** — on the frontend: component name → your component.

## Who is responsible for what

The model has two sides:
- the **server** keeps the templates (blocks), loads the data, puts the two together (\`build\`) and turns the result into final props (\`resolve\`),
- the **frontend** maps component names to its components (the registry) and renders the finished tree (\`<Render>\`).

They are connected by the **contract** — a TypeScript type describing which components exist and what props they take. It is the only thing both sides have to share.

In \`examples/next\` (Next.js, App Router) both sides live in one application: \`build\` and \`resolve\` run in a Server Component, and \`<Render>\` renders the result right away. The split still holds: the same page is available as JSON (\`/api/home\`), so a completely different frontend could render it, e.g. a mobile app with its own registry.

## How data flows

\`\`\`
contract (type)      — which components exist and what props / slots they have
   │
blocks               — node('card', { props, slots, children }) — structure without data and without IDs
   │
page({ sections, data })
   │  build(ctx)      layout (IDs, remove, patch) → load (page data, section loaders) → assign (bindings)
   ▼
PageResult (JSON)    — layout (tree of nodes with IDs) and data (node ID → data) kept separate + report;
   │                   can be cached and sent over the network
   │  resolve()       props from the layout + node data → final props (toProps or deep merge)
   ▼
ResolvedPage (JSON)  — tree of { key, component, props, slots, children }
   │  <Render registry>
   ▼
React                — the registry turns a component name into a React component
\`\`\`

Each stage has a single responsibility. The layout doesn't know the data (it can be built without any API calls), the data doesn't know the layout (it reaches its place through a selector), and the frontend knows neither the blocks nor the data sources — it gets a finished tree.

## End-to-end example

A page with one section: a grid with two cards, each card with a slot for a badge.

\`\`\`ts
type Contract = {
  grid: { columns?: number }
  card: { title: string; href: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }
  badge: { label: string }
}

const ui = createDedal<Contract>({
  defaults: { card: { size: 'md' } },
  toProps: {
    // toProps is also called for nodes without data (data: undefined) — hence the condition
    card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
      data ? { ...props, title: data.headline, href: \`/a/\${data.slug}\` } : props,
    badge: ({ props, data }: ToPropsInput<Contract, 'badge', string>) => (data ? { ...props, label: data } : props),
  },
})

const home = ui.page({
  sections: [
    ui.section('news', ui.node('grid', {
      props: { columns: 2 },
      children: [ui.repeat(ui.node('card', { slots: { badge: ui.node('badge') } }), 2)],
    })),
  ],
  data: async () => ({
    news: {                                        // section key
      card: await api.latest(2),                   // [{ headline: 'First', slug: 'first' }, …]
      'card > :slot(badge)': ['Sport', 'World'],   // a badge in every card
    },
  }),
})
\`\`\`

**Step 1.** \`await home.build()\` returns a \`PageResult\` — layout and data separately (abridged):

\`\`\`
sections: [{ key: 'news', layout:
  { id: 'news', component: 'grid', props: { columns: 2 }, children: [
    { id: 'news.0', component: 'card', props: { size: 'md' },
      slots: { badge: { id: 'news.0:badge', component: 'badge', props: {} } } },
    { id: 'news.1', component: 'card', props: { size: 'md' },
      slots: { badge: { id: 'news.1:badge', component: 'badge', props: {} } } } ] } }]
data: {
  'news.0': { headline: 'First', slug: 'first' },
  'news.1': { headline: 'Second', slug: 'second' },
  'news.0:badge': 'Sport',
  'news.1:badge': 'World',
}
report: { … }   — what was assigned, what was removed, what was missing
\`\`\`

Every node got an ID from its position (\`news.0\` — the first child of the root of section \`news\`, \`news.0:badge\` — its \`badge\` slot), \`size: 'md'\` comes from \`defaults\`, and the data is assigned to IDs — not yet combined with props.

**Step 2.** \`ui.resolve(result)\` combines the two through \`toProps\` and returns a \`ResolvedPage\`:

\`\`\`
{ key: 'news', component: 'grid', props: { columns: 2 }, children: [
  { key: 'news.0', component: 'card', props: { size: 'md', title: 'First', href: '/a/first' },
    slots: { badge: { key: 'news.0:badge', component: 'badge', props: { label: 'Sport' } } } },
  … ] }
\`\`\`

**Step 3.** \`<Render tree={resolved} registry={{ grid: Grid, card: Card, badge: Badge }} />\` renders, in practice, the same thing as this JSX:

\`\`\`tsx
<Grid columns={2}>
  <Card size="md" title="First" href="/a/first" badge={<Badge label="Sport" />} />
  <Card size="md" title="Second" href="/a/second" badge={<Badge label="World" />} />
</Grid>
\`\`\`

Children from the layout go to the component's \`children\`, and slots go to the props named after the slot, as ready-made React elements.

In a Next app the whole thing is a few lines in a Server Component:

\`\`\`tsx
export default async function Page() {
  const ctx = { device: 'desktop' }
  const resolved = ui.resolve(await home.build(ctx), { ctx })
  return <Render tree={resolved} registry={registry} />
}
\`\`\`

## Glossary

The terms used throughout these docs, from *contract* to *trace*, are collected on their own page: *Glossary*.

## Common tasks

- **A new page or section** — blocks from existing components, a section with \`patch\` / \`remove\`, data through bindings. Start with *Tutorial*, then *Layout*, *Data*, *Sections*.
- **A new component** — (1) add it to the contract with its props (slots as \`Slot\` / \`Slot[]\`), (2) add an implementation to every registry — \`satisfies Registry<Contract>\` won't compile without it, (3) if needed, \`defaults\` and \`toProps\` in the instance options, (4) use it in a block: \`node('name', …)\`. Only this change requires a frontend deployment.
- **Something doesn't show up or shows up wrong** — the devtools panel (*Devtools*) and the warning descriptions in *Data*, *Sections*, *Rendering*.
- **Build throws an exception** — *Errors*: every message with an explanation.

## How to read these docs

Each case page shows one thing: a description, the code (the same code that runs), the result and the devtools report — or the exception, when the build fails. The "See it live" box tells you what to open in the devtools panel (the button with the Dedal logo in the bottom-right corner). The dot next to a case in the menu: green — works, yellow — warning in devtools, red — error in devtools, purple — build throws an exception.

Reading order: *Why Dedal* and *Quick start* if you haven't yet, *Tutorial* (a whole page step by step), *Going to production* and *Another domain: a dashboard*, then *Layout*, *Data* and *Sections* — your everyday tools. *Cache & queries* and *Rendering* — once the page already works. *Errors* and *Devtools* — when something doesn't work.`,

  tutorial: `In seven steps you will build the home page of a news site — and then change its layout without touching the code. Each step adds one thing and shows the result live; step 8 is an exercise: the same page with five hidden mistakes to find in the devtools panel.

- **1. Where we are going** — the finished page and the JSON that describes it.
- **2. Contract and registry** — the two halves and the one thing they share.
- **3. A block and its data** — layout without texts, data placed by selectors.
- **4. The template as data** — the template moves out of the code; the editors change it, the page follows. This is the step that shows why server-driven UI exists.
- **5. Slots and toProps** — components inside components; API data → props.
- **6. Variants** — mobile and desktop from one template set, \`patch\` and \`remove\`.
- **7. When data is missing** — empty sections, failing APIs, too few articles.
- **8. Debugging** — an exercise with the devtools panel.

The example is a content site because it is easy to picture, but nothing in Dedal is specific to content: the same steps apply to a mobile app screen, a dashboard or an onboarding flow — *Another domain: a dashboard* shows one.

Shared sections, streaming and cache — the things you add before production — are in *Going to production*, after the tutorial. If the idea of server-driven UI is new to you, read *Why Dedal* and *Introduction* first.

## How to read it

Each step has:
- a description — what we're doing and why,
- the code — the real files behind these docs (contract, instance, toProps, registry — the same as in \`examples/next\`) and the page code for this step,
- the result — the page built from this code,
- "See it live" — what to open in the devtools panel (the button with the Dedal logo in the bottom-right corner, or \`Alt+Shift+S\`),
- the devtools report — the same thing as text.

Later steps use blocks from earlier ones — it's worth going in order (the "next" link at the bottom of the page).

## What it looks like in a project

Files of the Next.js example (\`examples/next\`):

\`\`\`
ui/contract.ts           — contract: components and their props (shared by server and frontend) + the Ctx type
ui/dedal.ts             — instance: createDedal<Contract>({ defaults, toProps })
ui/to-props.ts           — mappings of API data → component props
ui/home.page.ts          — blocks (node, repeat) and the page: sections, data, query, cache
ui/registries/*.tsx      — registries: component → React components (shadcn, Radix Themes)
ui/page-view.tsx         — build → resolve → <Render> (in debug mode + devtools)
app/(radix)/radix/…      — Next routes that render PageView with the chosen registry
\`\`\`

In a larger project blocks are usually extracted into separate modules (e.g. \`blocks.ts\`), and each page into its own file.

Installation: \`npm i github:dawidglosny/dedal#v0.6.5\`. You need TypeScript and React (for \`dedal/react\`, React 18+); the server can be anything (Node 20.9+) — here it's Next.js (App Router, Server Components).`,

  production: `The tutorial covers the model. This group covers what you add before production: data shared between pages, slow sections, and not calling your APIs on every request.

- **Shared sections** — a section with its own loader (a header, a menu, a featured article) is defined once and added to any page; its loader runs in parallel with the page's.
- **Deferred sections** — slow or personalised sections go out later, streamed in, so they don't hold up the page.
- **Queries and page cache** — a data source fetched once and shared by loaders and requests; the whole page result cached per key, refreshed in the background.

The details of each are in the groups that follow: *Sections* (loaders, \`optional\`, \`defer\`) and *Cache & queries* (keys, statuses, store, invalidation).`,

  dashboard: `**In short:** the tutorial builds a content page, but nothing in Dedal is about content. This group uses the same engine for an analytics dashboard — a different contract, different components, different data — to show that the idea carries over.

The three parts map one to one:
- **structure** — which widgets, in what order and how wide. It depends on the role (an admin, support, a viewer) and on the customer, who can arrange their own dashboard and save it,
- **data** — metrics, time series, tickets, incidents, each from its own source,
- **components** — a widget library: stat cards, a chart, a table, alerts.

What changes between the domains is only the contract and the registry. Templates, selectors, \`patch\` and \`remove\`, stored layouts with validation and versioned cache keys, the rules for missing data and devtools work the same way.

The same reasoning applies to other screens assembled from a known set of blocks: mobile app screens, onboarding flows, store pages, settings pages.`,

  glossary: `Every term used in these docs, in one place. The five to start with — contract, block, section, binding, registry — are explained with an example in *Introduction*.

- **server-driven UI (SDUI)** — a model in which the server decides the structure of the screen and the frontend only renders it.
- **contract** — a TypeScript type: component name → its props (\`card: { title: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }\`). A single source of truth for the server and the frontend.
- **component** — a name from the contract (\`card\`, \`grid\`). It is not a React component — the registry assigns a React component to that name.
- **instance** — the result of \`createDedal<Contract>(options)\`, created once per project; you take \`node\`, \`repeat\`, \`section\`, \`page\`, \`query\`, \`resolve\` from it.
- **block** — a tree built from \`node()\` / \`repeat()\` or written as plain JSON: pure structure, without data and without IDs. A plain value (or a function returning a block) that can be exported and used across many pages.
- **node** — an element of the tree: component, props, children, slots, an optional alias. In the layout it gets an ID.
- **children and slot** — two ways of nesting. Children are regular content (\`children\` in React). A slot is a named place declared in the contract as \`Slot\` (one node) or \`Slot[]\` (a list) — it goes to the prop with that name.
- **ID** — a node identifier derived from its position: \`news\` (section root), \`news.0.1\` (children), \`news.0:badge\` (slot), \`hero:actions.1\` (list slot). Layout and data meet by ID.
- **alias** — a name given to a node in a block (\`alias: 'featured'\`), referenced by the selector \`#featured\`.
- **selector** — an expression in CSS syntax that selects nodes (\`card\`, \`#featured\`, \`card:first-child\`, \`card > :slot(badge)\`). The same matcher works in patch, remove, bindings, \`required\` and devtools.
- **section** — a piece of the page: a unique key, a block and rules (patch, remove, loader, onEmpty…). The key is the prefix of its node IDs and the key of its data.
- **page** — a list of sections (fixed or dependent on ctx), where they get their data from, and an optional cache.
- **ctx** — the request context (e.g. \`{ device }\`); it is passed to \`sections\`, loaders, \`cache.key\` and \`toProps\`.
- **layout** — the tree of a section's nodes after expanding \`repeat\`, assigning IDs, \`remove\` and \`patch\` — still without data.
- **loader** — an async function returning data: the page's \`data\` (for many sections) or a section's \`data\` (for that section only).
- **binding** — an entry in a section's data: \`{ selector: items }\`. The selector picks nodes, and the items go to them one by one.
- **assign** — the stage in which bindings are distributed to nodes; this is where the rules for missing data apply (\`onShortage\`, \`onSurplus\`, \`onEmpty\`).
- **PageResult** — the result of \`build\`: the sections' layout, data (node ID → data) and a report. Plain JSON.
- **defaults** — default props of a component, added by \`node()\` when the block is created.
- **toProps** — maps data (the API shape) to component props; pure functions without IO.
- **resolve** — combines the layout with data into final props; the result is a **ResolvedPage**.
- **registry** — a map of component → React component on the frontend side.
- **query** — a data source with the instance's cache (\`ui.query\`), shared by loaders and requests.
- **deferred section** — a section built in a separate request and streamed in later (\`defer\`).
- **trace** — debug mode: props origin, a detailed report, timings — for devtools.`,

  limitations: `What Dedal doesn't do — or doesn't do yet. Knowing this before you start saves a surprise later. Planned work is in the roadmap (\`docs/ROADMAP.md\` in the repository).

## Scope

- **No state, no behaviour in templates.** Props are JSON: a template can't carry a function or an event handler. Interactive parts — tabs, forms, a cart — are registry components with their own logic; the template only places them and passes data. Dedal is for screens assembled from blocks, not for application UI (*Why Dedal*).
- **No editor.** Templates come from code, a database, a CMS or Figma (*Guides*); Dedal has no visual editor and no Figma plugin.
- **React is the only renderer shipped.** \`dedal/react\` works with Server Components, SSR and on the client. Any other client renders the JSON with its own small renderer (*A client without React*); \`dedal/astro\` is planned.
- **The server side is JavaScript.** The engine runs in Node 20.9+, edge runtimes and the browser. A backend in another language needs a JS layer that builds the pages, or serves only the data to one.

## Templates

- **No built-in runtime validation.** The contract is types only; templates from outside the code must be validated by the app (*Templates in a database or CMS* has a validator). An unknown component in an unvalidated template renders the registry's \`fallback\`.
- **JSON templates don't get \`defaults\`.** \`node()\` adds them; a template parsed from JSON carries its props itself.
- **\`sections\` is synchronous.** A template from async storage is loaded first, and the page is created per request (*Templates in a database or CMS*).
- **Selectors are a subset of CSS.** Components, aliases, attributes, \`:first-child\` / \`:last-child\` / \`:nth-child\` / \`:nth-last-child\`, \`:slot\`, \`:root\`, descendant, child and lists. No classes, \`:not()\`, \`:has()\`, \`+\` or \`~\` (*Layout*).

## Data

- **Empty containers stay.** \`onShortage: 'remove'\` removes the nodes without data, not a parent left empty — a grid with no cards still renders. Workarounds: put the container in a section of its own, where \`required\` and \`onEmpty\` remove the whole section (*Sections*), or bind the container too and give it \`null\` when it should go.
- **A node gets one data item.** Bindings place items one per node, in tree order; data that has to be split between nodes is prepared in the loader (per component).

## Cache

- **In-memory by default.** The store is per process. Several server instances need a shared store (Redis, KV) — an adapter you write against the \`Store\` interface (*Cache & queries*).
- **No dependency tracking.** Invalidating a query doesn't invalidate the pages built from it; invalidate both by prefix.

## Devtools

- **Debug mode exposes data.** The payload contains the page's structure and data — enable it only for trusted requests (*Devtools*, "Enabling it safely").
- **Markers change the DOM in debug mode.** \`<Render debug>\` wraps nodes in \`<dedal-node style="display: contents">\` — CSS that depends on direct children may behave differently while debugging.

## The package

- **Before 1.0.** The API may still change between minor versions; every change is in the changelog.
- **Installed from GitHub tags.** \`npm i github:dawidglosny/dedal#v…\`, built on install; not on the npm registry yet.`,

  layout: `**In short:** the layout is the skeleton of a section — "a heading, then a grid of six cards, each with a badge" — with no articles in it yet. Write it once, fill it with any data, adjust it per page or device without copying it.

The layout is the structure of a section: which components, in what order, in which slots, with which props — **without data**. You describe it with blocks: \`node(component, { props, children, slots, alias })\`.

## Why a separate layout

The layout doesn't depend on data, so:
- it can be built without API calls (pure CPU, a fraction of a millisecond),
- the same block handles different data (3 articles or 30 — repeat and the missing-data rules decide what stays),
- a layout change (order, variants, A/B) is a change to a block on the server, not a frontend deployment.

## Builders: node, repeat, clone

You take them from the instance (\`ui.node\`, \`ui.repeat\`, \`ui.clone\`) — that way they are typed by the contract and add \`defaults\`.

- \`node(component, { props, children, slots, alias })\` — a single node. The instance \`defaults\` are merged with \`props\` (deep merge: nested objects are merged, arrays and \`undefined\` replace the default value).
- \`repeat(block, n)\` — the same block \`n\` times as consecutive siblings; \`n\` is an integer \`>= 1\`. Each copy gets its own ID.
- \`clone(n, a, b)\` — repeats a sequence of blocks: \`clone(2, a, b)\` gives \`[a, b, a, b]\` (to spread into \`children\`).

A block is a plain TypeScript value — you can parameterize it with a function (\`cards(title, count)\`), compose it from smaller blocks, export it and use it across many pages.

## Children and slots

- **children** — the regular content of a node (a list). In React it goes to the component's \`children\`.
- **slots** — named places declared in the contract as a prop of type \`Slot\` (one node, e.g. \`media\` in the hero) or \`Slot[]\` (a list, e.g. \`actions\`). In React they go to the prop named after the slot as a ready-made element (or an array of elements).

Slots are part of the layout, not the data: the server decides what goes into a slot (a badge, an avatar, buttons). Data is assigned to nodes in slots like to any other node — with the selector \`:slot(name)\`.

## Node IDs

The ID follows from the position in the layout (after expanding \`repeat\`):
- section root — the section key: \`news\`,
- child — parent ID + \`.\` + index: \`news.0\`, \`news.0.2\`,
- single slot — parent ID + \`:\` + slot name: \`news.0:badge\`,
- list slot — additionally the index within the slot: \`hero:actions.1\`.

Layout and data meet by ID, even when they came from different places (cache, network). Changing a block changes the IDs — that's why layout and data should always come from the same \`build\`.

A custom ID generator (\`createDedal({ id })\`) is possible, but it must produce IDs unique across the **whole page** — the simplest way is to start with \`prefix\` (the section key), like the built-in one.

## patch and remove

A section can modify a block without copying it:
- \`patch: { selector: props }\` — applies props to the matched nodes (deep merge; when several patches set the same prop, the later entry wins),
- \`remove: selector\` (or a list of selectors) — removes the matched nodes together with their subtree, including from slots.

Order of stages: block → \`remove\` → \`patch\` → data assignment. Patch selectors see the tree **before** patching (the way CSS sees the DOM) — a patch that changes \`size\` doesn't affect whether another patch with \`[size=lg]\` matches.

## Selectors — cheat sheet

CSS syntax, matched against the tree of a single section (\`:root\` is the section root):
- \`card\` — component; \`*\` — any node,
- \`#featured\` — alias,
- \`[size]\` — the prop exists; \`[size=lg]\` — the prop has a value (compared as a string); \`[style.height="100%"]\` — a nested prop, value in quotes,
- \`:first-child\`, \`:last-child\`, \`:nth-child(2)\`, \`:nth-child(odd)\` / \`(even)\`, \`:nth-child(3n+1)\`, \`:nth-last-child(…)\` — position counted from 1, after expanding \`repeat\`; in a list slot — within the slot,
- \`:slot\` — a node in any slot; \`:slot(badge)\` — in the \`badge\` slot,
- \`:root\` — the section root,
- \`a b\` — descendant (also through slots), \`a > b\` — direct child or slot content, \`a, b\` — one of the selectors.

Other CSS constructs (classes \`.x\`, \`:not()\`, \`:has()\`, \`+\`, \`~\`) are not supported — they produce a syntax error with the position. The same matcher works in patch, remove, bindings and devtools — learn it once, use it everywhere. You can test a selector in the search field of the *tree* tab in devtools before you put it in your code.

## How to use it

- Define blocks for recurring layouts (a list of cards, a hero, a grid).
- In a section use the block and adjust it with \`patch\` / \`remove\` instead of copying the block with a small change.
- Variants (mobile / desktop, A/B) — \`sections: (ctx) => [...]\`: different blocks or different patches per ctx.
- Give an alias to places you need to refer to regardless of position (a featured card).

## What to watch out for

- A selector that matches nothing (a typo, a changed block) doesn't raise an error — devtools show it as a warning (with a hint when the selector can be corrected).
- \`remove: ':root'\` removes the whole section — its loader doesn't run, and page data under its key goes to \`unknownData\`.
- A section root is a single node (it can't be repeated with \`repeat\`), and a single slot accepts one node — several require a list slot (\`Slot[]\`).`,

  data: `**In short:** you have a list of articles and a template with cards; this is how the articles land in the cards. You say *which* nodes get the data (\`card\`, \`#featured\`) instead of counting positions, so the template can change without breaking the data.

Data reaches the layout through **bindings**: a section's data is an object \`{ selector: items }\`. The selector picks nodes in the section, and consecutive items go to consecutive matched nodes — in tree order.

\`\`\`ts
data: async () => ({
  news: {                                   // section key
    card: articles,                         // binding: each card gets the next article
    'card > :slot(badge)': categories,      // binding to slots
  },
})
\`\`\`

## Why selectors and not a single list

A single flat list of data per section (first element to the first component, second to the second…) breaks with every block change: adding a heading shifts all the data by one. Bindings are addressed — \`card\` gets the articles, \`badge\` the categories, regardless of their order in the block. Data never crosses between sections — the section key is explicit.

## How assignment works exactly

- **Tree order**: a node, then its slots (in the order from the block), then its children — recursively. The first item goes to the first matched node in that order.
- **The order of bindings matters**: they are processed in entry order, and a node taken by an earlier binding is skipped by later ones. That's why specific ones (\`#featured\`) are written before general ones (\`card\`).
- **Shape**: a binding is an array of items or \`{ items, onShortage, onSurplus }\` (custom rules for that binding). An item can be anything serializable to JSON — an object, a string, a number; \`null\` / \`undefined\` = no data for that node.
- **The result** is a map \`node ID → item\` in \`PageResult.data\`; only \`resolve\` combines it with props.

## Data vs props

Data can have the API's shape (\`Article\`) rather than the component's props. **toProps** (an instance option) maps it per component to the contract's props — a pure module, no IO, runs on the server and on the frontend. It receives \`{ props, data, node, ctx }\` and is called for every node of the given component, **including those without data** (\`data: undefined\`). Without toProps, data (it must be an object) is merged with props directly (deep merge, data wins).

Props precedence: \`defaults\` (added by \`node()\` when the block is created) → props from the block → section \`patch\` → data. \`resolve\` passes the props from the layout and the data to \`toProps\` — its result is the final props (hence \`...props\` in the mapping). Devtools show the source of every prop.

## When the counts don't match

API data rarely fits the layout perfectly:
- **fewer items than nodes** — \`onShortage\`: \`'remove'\` (default — a node without data disappears together with its subtree), \`'keep'\` (stays with the props from the layout, e.g. a placeholder), \`'error'\` (exception),
- **more items than nodes** — \`onSurplus\`: \`'ignore'\` (default — the surplus is skipped) or \`'error'\`,
- \`null\` / \`undefined\` in the list = no data for that node (as with a list that's too short).

The rules are set on three levels — the narrower one wins: instance (\`createDedal({ assign: { onShortage, onSurplus } })\`), section (\`section(key, block, { policies })\`), a single binding (\`{ items, onShortage }\`).

## How to use it

- Prepare data per component (a list of articles for \`card\`, categories for \`badge\`), not one list for the whole section.
- Write specific bindings (\`#featured\`) before general ones (\`card\`).
- Decide what happens on shortage: cards that disappear (\`remove\`) or fixed slots (\`keep\`).

## What to watch out for

- Mismatches (a binding with no matches, wrong order, data that got lost) don't break the page — devtools show them in *sections* with an explanation and a list of the data that didn't make it onto the page.
- \`onShortage: 'remove'\` on a container also removes its children — together with the data they already received (*Dropped data*).`,

  sections: `**In short:** a page is a stack of sections — a header, a hero, the latest news, recommendations. Each section has its own template and its own rules: where its data comes from, and what to do when that data is missing or slow.

A section is a piece of the page: a key, a block and rules. A page (\`ui.page\`) is a list of sections plus where they get their data from.

\`\`\`ts
const home = ui.page<Ctx>({
  sections: ctx => [header, ui.section('news', newsBlock, { patch: { … } })],  // or a fixed array
  data: async ctx => ({ news: { card: await api.latest() } }),               // page data
  cache: { key: ctx => ['home', ctx.device] },                               // optional
  onSectionError: (error, { section }) => log(section, error),               // optional
})
\`\`\`

Section options (\`ui.section(key, block, options)\`): \`remove\`, \`patch\` (see *Layout*), \`policies\` (see *Data*), \`data\`, \`optional\`, \`onEmpty\`, \`required\`, \`defer\` — described below. A section key must be unique within the page.

## Where a section gets its data

- **page data** — \`page({ data: (ctx) => ({ news: {...}, hero: {...} }) })\` — one place for many sections,
- **section loader** — \`section(key, block, { data: (ctx) => bindings })\` — the section loads its own data; it returns the bindings of that section only (without the section key),
- **no data** — a static section: renders the layout alone (e.g. a heading with text in the block).

A section loader lets you build **shared sections** (header, footer, menu): you define them once with a loader and include them in many pages without repeating their data in each one. All loaders and the page data run **in parallel**. Loaders run only for sections present on the page (not for those removed with \`remove: ':root'\` or deferred).

## When something goes wrong

- **A loader error** aborts the build by default — a page missing a key section shouldn't render silently. \`optional: true\` removes only that section instead (e.g. recommendations), and the error goes to the page's \`onSectionError\` (logs, metrics).
- **An empty section** — the section received bindings (from a loader or from page data), but after assignment no node has data. \`onEmpty\` decides: \`'remove'\` (default), \`'keep'\`, a block (an empty state, e.g. "No results") or \`'error'\`. \`required: 'card'\` counts only nodes matching the selector — for when the heading always gets data, and it's the cards that decide whether the section makes sense.
- **A section without bindings** — when the page data has no entry under its key or the loader returned \`undefined\`, the section isn't "empty" in the \`onEmpty\` sense: it stays with just the layout (devtools warn when this looks like a mistake).

## Deferred sections (streaming)

\`defer: { fallback }\` — the page result contains only a placeholder (\`fallback\`, with \`deferred: true\`), and the loader doesn't run. The content is built by \`page.section(key, ctx)\` in a separate call — it returns a \`PageResult\` with that one section, so \`resolve\` and \`<Render>\` work unchanged. In Next it's an async Server Component inside \`<Suspense>\`: the page goes out immediately, and the slow section (recommendations, personalized data) arrives when it's ready.

\`\`\`tsx
async function Deferred({ sectionKey, ctx }: { sectionKey: string; ctx: Ctx }) {
  const resolved = ui.resolve(await home.section(sectionKey, ctx), { ctx })
  return <Render tree={resolved} registry={registry} />
}

<Render
  tree={resolved}
  registry={registry}
  deferred={({ sectionKey, fallback }) => (
    <Suspense fallback={fallback}>
      <Deferred sectionKey={sectionKey} ctx={ctx} />
    </Suspense>
  )}
/>
\`\`\`

Without the \`deferred\` prop, \`<Render>\` shows only the fallback. A deferred section is outside the page cache (only the placeholder is cached) — a good place for per-user data.

**The placeholder is a block.** \`defer.fallback\` is structure, like any template: built on the server, part of the page result and its cache, rendered by the registry. Use a component from the contract — a skeleton that mimics the section, so the page doesn't jump when the content arrives (*Deferred: the placeholder*).

**When the section fails or is empty.** The page has already gone out, so \`page.section()\` decides what replaces the placeholder:
- loader error, section \`optional\` — no sections in the result (\`report.failedSections\`, \`onSectionError\`): the placeholder disappears,
- loader error, section not \`optional\` — \`page.section()\` throws: in Next the error goes to the nearest error boundary, with an endpoint to its error response,
- empty section with \`onEmpty: 'remove'\` — no sections (\`report.removedSections\`): the placeholder disappears.

Deferred sections are usually the optional part of a page, so mark them \`optional\` (*Deferred: when the section fails or is empty*).

**Without \`<Suspense>\`** (a single-page app, Web Components, a mobile app): give deferred sections their own endpoint — \`page.section(key, ctx)\` + \`resolve\` on the server; on the client, render the page, find sections with \`deferred: true\`, fetch each one and swap it in (or remove the placeholder when the result has no section). \`ctx\` travels with the request (*Deferred without Suspense*, \`examples/web-components\`).

## Two fallbacks

The word appears in two unrelated places:
- \`defer: { fallback }\` — a **block** shown in place of a deferred section until its content arrives. Defined on the server, part of the page.
- \`<Render fallback={…}>\` — a **React component** rendered instead of a node whose component isn't in the registry. Defined on the frontend; see *Rendering*.

(And \`<Suspense fallback>\` is React's own: in the \`deferred\` callback it receives the first one, already rendered.)

## Page stages

\`page.build(ctx)\` is three stages in a single call (plus cache). They are also available separately — e.g. when you want to cache the layout independently of the data:
- \`page.layout(ctx)\` — the sections' layout, no IO,
- \`page.load(ctx)\` — page data and section loaders (in parallel),
- \`page.assign(sections, data, ctx)\` — data assignment, the result is a \`PageResult\`.

## Why it works this way

Every "what if something's missing" decision is explicit and has a default that doesn't break the page where that's safe (empty promotions disappear) and does break it where silence would be a bug (a loader error without \`optional\`). Everything that was removed or skipped is in the report (\`report.removedSections\`, \`failedSections\`, \`emptySections\`, \`unknownData\`) and in devtools.

## How to use it

- Shared sections (header, footer) — with their own loader, exported and included in pages.
- "Nice to have" sections — \`optional: true\`; sections without which the page makes no sense — \`onEmpty: 'error'\`.
- Slow or personalized ones — \`defer\`.

## What to watch out for

- Page data under the key of a section that has its own loader, or of a deferred section, is an exception (it's unclear which one should win).
- Data under a key that isn't on the page (a typo, a section from another variant) is skipped — devtools: \`unknownData\` with a hint.`,

  cache: `**In short:** don't build the same page or call the same API on every request. Dedal can keep whole pages and individual data sources in memory, serve them instantly and refresh them in the background.

Two levels of cache: **page** (the whole \`build\` result) and **query** (individual data sources). Both live in the instance and work in stale-while-revalidate mode.

## Page cache

\`page({ cache: { key: ctx => ['home', ctx.device] } })\` stores the \`build\` result under a key. The key is an array of JSON values covering everything the sections and data depend on — here \`device\`. A key of \`undefined\` = this ctx isn't cached (e.g. a logged-in user). Without the \`cache\` option the page isn't cached at all.

Stale-while-revalidate (entry age):
- up to \`staleTime\` (default 5 s) — result from cache (\`hit\`),
- up to \`maxAge\` (default 5 min) — the old result immediately, refreshed in the background (\`stale\`),
- older, or no entry — build and wait for the result (\`miss\`),
- concurrent requests for the same key wait for a single build (no stampede of API calls),
- errors aren't cached; when a background refresh fails, the previous entry stays.

Timings are set for the instance (\`createDedal({ cache: { staleTime, maxAge } })\`) and overridden per page (\`cache: { key, staleTime, maxAge }\`) or per query. It must hold that \`0 <= staleTime <= maxAge\`.

## Query

\`\`\`ts
const articlesQuery = ui.query({
  key: (count: number) => ['articles', count],   // the key must cover all parameters of fn
  fn: (count: number) => api.latest(count),
  staleTime: 60_000,
})

const list = await articlesQuery(8)               // in a page or section loader
\`\`\`

A query is a data source cached in the instance, shared by pages, sections and requests — e.g. a menu fetched once for all pages. A key of \`undefined\` = this call skips the cache (\`bypass\`). A result from cache is frozen and shared between requests — read-only: \`[...items].sort()\`, not \`items.sort()\`. The result must be JSON (an external store serializes it — a \`Date\` or a \`Map\` won't survive).

Query is optional — a loader is a plain async function, and you can call any source in it (fetch, an API client, a cache the application already has).

## Why in the instance

The cache lives as long as the instance: create it once (at module level), not in every request. Pages and queries have separate key spaces (a page's \`['menu']\` and a query's \`['menu']\` are different entries), but they are shared between pages — start a page's key with its name.

\`ui.invalidate(prefix)\` removes page and query entries whose key starts with \`prefix\` (\`[]\` — all of them), e.g. after publishing in a CMS: \`ui.invalidate(['articles'])\`.

## Store and instance options

\`createDedal({ cache: { … } })\`:
- \`store\` — the entry store; by default \`memoryStore()\` (process memory, LRU, 500 entries). For multiple server instances — your own adapter (Redis, KV) with \`get\`, \`set\`, \`delete\` methods; optionally \`deletePrefix\` (without it \`invalidate\` removes only the entry with exactly that key) and \`lock\` (one refresh at a time across the whole cluster),
- \`waitUntil\` — on edge / serverless hands the background refresh to the environment (e.g. \`waitUntil\` from \`@vercel/functions\`) so it isn't cut off after the response,
- \`onEvent\` — cache events (\`{ key, status, ms }\`) for logs and metrics.

## Debug and cache

Debug mode (\`trace\`) **bypasses the page cache** — it neither reads nor writes; devtools always show a fresh build. The query cache keeps working; the *timing* tab shows the status of each query: \`miss\`, \`hit\`, \`stale\`, \`bypass\`, \`error\` (requires \`AsyncLocalStorage\` — in Next it's global).

## What to watch out for

- User-dependent data: put the user in the key or use an \`undefined\` key — otherwise one user will see another user's page. Better: make the personalized part a deferred section (outside the page cache).
- A query key that omits one of the \`fn\` parameters will return a result for different parameters.
- Results from cache are frozen — mutating them throws an exception.`,

  rendering: `**In short:** the last mile — turning the page description into real components on the screen. The server produces a tree of component names and props; the frontend's registry decides which component each name means.

Rendering is two steps: \`resolve\` (combining the layout with data into props) and \`<Render>\` (props → React components through the registry).

## resolve

\`ui.resolve(result, { ctx })\` turns a \`PageResult\` (layout and data separately) into a \`ResolvedPage\` — a tree of \`{ key, component, props, slots, children }\` with final props. For each node: when the component has \`toProps\`, its result is the final props (it receives the props from the layout — already with \`defaults\` — the node's data and \`ctx\`); without \`toProps\`, data (an object) is merged with props (deep merge).

\`resolve\` is a pure function — it can run on the server (as in these docs) or on the frontend, when the frontend receives a \`PageResult\` through an API. It checks the format version (\`dedal: 1\`) and rejects unknown ones.

## Registry

The registry maps component names from the contract to React components:

\`\`\`tsx
const registry = { card: Card, grid: Grid, … } satisfies Registry<Contract>
<Render tree={resolved} registry={registry} fallback={Missing} />
\`\`\`

A component in the registry receives (\`RenderProps<Contract, 'card'>\`):
- the props from the contract (without slots),
- each slot as a prop named after it: \`ReactNode\` for \`Slot\`, \`ReactNode[]\` for \`Slot[]\`,
- children from the layout as \`children\`.

\`\`\`tsx
card: ({ title, href, size = 'md', badge, footer }) => (
  <Card data-size={size}>
    {badge}
    <a href={href}>{title}</a>
    {footer}
  </Card>
)
\`\`\`

\`satisfies Registry<Contract>\` checks at compile time that all components are present and the props match. The registry is an adapter: the contract describes what the page needs, and the registry translates it to the API of a specific library (badge \`variant: 'secondary'\` → \`variant="soft"\` in Radix Themes) — switching libraries is a change to the registry, not to the server.

\`<Render>\` uses no hooks or state — it works in React Server Components, in SSR and on the client; components in the registry can be client components (\`'use client'\`). Options: \`fallback\` (a component for components missing from the registry, receives \`{ component, nodeKey }\` — below), \`deferred\` (how to render a deferred section: receives \`{ sectionKey, fallback }\`, where \`fallback\` is the section's placeholder already rendered; without it only the placeholder shows — see *Sections*), \`debug\` (markers for devtools).

## Problems that don't break the page

\`resolve\` doesn't throw on bad data — it collects **issues** (\`resolved.issues\`: \`{ id, message }\`), and the node gets the props from the layout:
- non-object data without toProps,
- an exception in toProps, or toProps returning a non-object,
- data for an ID that isn't in the layout (layout and data from different builds).

A component missing from the registry renders \`fallback\` (or nothing). Why: one bad article shouldn't take down the whole page. Where you'd rather have a hard error (tests, CI) — \`resolve(result, { onIssue: 'throw' })\`.

## The fallback for a missing component

\`<Render fallback={Missing}>\` renders \`Missing\` instead of every node whose component isn't in the registry. It receives \`{ component, nodeKey }\` — the name from the template and the node's ID. Without \`fallback\` such a node renders nothing, together with its children and slots.

\`\`\`tsx
// development: make it visible
const Missing = ({ component, nodeKey }: { component: string; nodeKey: string }) => (
  <div style={{ border: '2px dashed red', padding: 8 }}>Missing component “{component}” ({nodeKey})</div>
)

// production: render nothing, but report it
const Missing = ({ component }: { component: string }) => {
  reportMissing(component) // your logging / metrics
  return null
}
\`\`\`

When it happens: a template uses a component the frontend doesn't have yet — a stored template edited before the frontend release, an older mobile app, a typo in a JSON template. That's why the order of releases is: **the component in the registry first, then in templates**. Devtools list every missing component and the nodes it affects (*Component missing from the registry*).

Not to be confused with \`defer: { fallback }\` — the placeholder of a deferred section (*Sections*).

## What to watch out for

- Issues are visible in \`resolved.issues\` and in devtools (\`!\` in *tree*, messages in *sections*) — it's worth logging them in production.
- A frontend older than the server: a component that isn't in the registry renders \`fallback\` — deploy new components to the frontend first, then use them in blocks.`,

  errors: `**In short:** most problems don't break the page — they show up as warnings in devtools. The ones on this page do: they stop the build with an exception, because carrying on would hide a bug. Each message says where, what and how to fix it.

Some problems abort the build or \`resolve\` with an exception — these are programmer errors (a bad block, bad syntax, conflicting configuration) or situations you yourself marked as unacceptable (\`onShortage: 'error'\`, \`onEmpty: 'error'\`, a loader without \`optional\`).

## Why exceptions

Silently working around such errors would hide them until production. An exception on the first build (locally, in tests) points to the problem right away.

## How to read the messages

Every message says:
- **where** — the section (\`section "news": …\`), the binding, the selector with the position,
- **what came in** — e.g. \`got array (3 items)\`, \`got 0\`,
- **what to do** — e.g. \`wrap it in a container\`, \`remove "news" from page data or drop the section's loader\`.

A loader error keeps the original error in \`cause\`.

## When the page doesn't build

Devtools won't show anything — there's no payload because there's no page. What's left is the exception message (in the server log, in the Next overlay). The pages in this group catch the exception and display its message.

## Exception vs warning

Shortage, surplus and empty sections don't break the page by default (a **warning** in devtools). Bad data (\`resolve\` issues) and a binding with no matches are an **error** (✗) in devtools, but the page renders. They only become exceptions once you set \`'error'\` (\`onShortage\`, \`onSurplus\`, \`onEmpty\`) or \`onIssue: 'throw'\` in \`resolve\`. A wrong data shape (a list instead of bindings, a binding that isn't a list) and anything that depends on the code (syntax, block structure, configuration) is always an exception.`,

  devtools: `**In short:** a panel in the browser that answers "why does this element look like this?" — click anything on the page and see where each prop came from, which data went where, what got lost, and what was slow.

Devtools show what Dedal did with a specific page: where every prop came from, which data went where, what got lost and why, how long the build took and which queries went to the API. This page describes where that information comes from and how to read it — tab by tab.

## Where the panel gets its data

\`\`\`
page.build(ctx, { trace: true })   build in debug mode: records props origin, bindings report, timings
        │                          (bypasses the page cache — always a fresh build)
ui.resolve(result, { trace: true }) combines layout + data, with the origin of every prop
        │
inspect(result, resolved)          devtools payload — plain JSON: sections, nodes, messages, timings
        │
<DevtoolsData payload />           payload embedded in the page in <script type="application/json">
<Render debug />                   every node wrapped in <dedal-node data-dedal-key="…"> (for "pick")
<Devtools />                       panel (Shadow DOM): reads the payload scripts, including ones streamed in later
\`\`\`

The panel doesn't ask the server for anything — everything is in the payload from the moment of rendering. A deferred section (streaming) arrives with its own payload; the panel merges them into a single view.

## How to enable it (Next, React Server Components)

Four pieces in debug mode: build and resolve with \`trace\`, markers in the DOM, the payload on the page, and the panel. A simplified version of \`ui/page-view.tsx\` from \`examples/next\` (here \`isDebug()\` simply means \`?debug=1\`):

\`\`\`tsx
import { Suspense } from 'react'
import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render } from 'dedal/react'
import { Devtools } from 'dedal/react/devtools'

export async function PageView({ ctx, registry }: { ctx: Ctx; registry: Registry<Contract> }) {
  const debug = await isDebug()                                 // see "Enabling it safely"
  const result = await home.build(ctx, { trace: debug })        // 1. props origin, report, timings; bypasses the page cache
  const resolved = ui.resolve(result, { ctx, trace: debug })

  return (
    <>
      <Render
        tree={resolved}
        registry={registry}
        debug={debug}                                           // 2. node markers in the DOM (for "pick")
        deferred={({ sectionKey, fallback }) => (
          <Suspense fallback={fallback}>
            <DeferredSection sectionKey={sectionKey} ctx={ctx} registry={registry} debug={debug} />
          </Suspense>
        )}
      />
      {debug && <DevtoolsData payload={inspect(result, resolved)} />}   {/* 3. payload for the panel */}
      {debug && <Devtools />}                                            {/* 4. panel */}
    </>
  )
}

// a deferred section adds its own payload — the panel merges it with the page payload
async function DeferredSection({ sectionKey, ctx, registry, debug }: { sectionKey: string; ctx: Ctx; registry: Registry<Contract>; debug: boolean }) {
  const result = await home.section(sectionKey, ctx, { trace: debug })
  const resolved = ui.resolve(result, { ctx, trace: debug })
  return (
    <>
      <Render tree={resolved} registry={registry} debug={debug} />
      {debug && <DevtoolsData payload={inspect(result, resolved)} />}
    </>
  )
}
\`\`\`

- \`inspect\` (\`dedal/devtools\`) — a pure function: a payload (JSON) with an index of nodes, selectors, data, messages and timings.
- \`<DevtoolsData>\` (\`dedal/react\`) — embeds the payload as \`<script type="application/json" data-dedal-devtools>\`, with escaping (data containing \`</script>\` won't close the script).
- \`<Devtools />\` (\`dedal/react/devtools\`) — a client component; the panel code is loaded dynamically only after mounting. Without the \`open\` prop the panel is open or closed the way it was left in this browser tab; \`open\` / \`open={false}\` forces the state.

## Enabling it safely

Debug mode **exposes the structure and data of the page** (all props, node data, cache keys) and bypasses the page cache — every request in debug is a full build with API calls. That's why the application turns it on, deliberately:
- outside production — always, or with a switch (\`examples/next\`: \`?debug=1\`),
- in production — only for trusted people, e.g. a cookie with a secret set by a protected endpoint. A query param alone in production is an invitation to everyone.

\`\`\`ts
import { cookies } from 'next/headers'

export async function isDebug() {
  if (process.env.NODE_ENV !== 'production') return true
  const token = process.env.DEDAL_DEBUG_TOKEN
  return Boolean(token) && (await cookies()).get('dedal_debug')?.value === token
}
\`\`\`

Without debug mode nothing changes: the \`build\` / \`resolve\` result is the same as without devtools, the DOM has no markers, and the panel code isn't loaded.

## Other environments

- **React without RSC (SPA, SSR)** — the same components: \`<Render debug>\`, \`<DevtoolsData>\`, \`<Devtools />\`. \`inspect()\` also works in the browser.
- **Backend → frontend (an API with JSON)** — the backend does \`build(ctx, { trace: true })\` only for trusted requests; the frontend calls \`resolve\` and \`inspect()\` (pure functions) on its side and renders as above.
- **Without React** — \`mountDevtools()\` from \`dedal/devtools/panel\` after the page loads; embed the payload as \`<script type="application/json" data-dedal-devtools>\`, replacing \`<\` with \`\\u003c\`. Without node markers in the DOM the panel shows *tree*, *sections* and *timing*, but doesn't highlight elements, and \`pick\` won't find anything.

## Opening the panel

With debug mode on, a button sits in the bottom-right corner of the page: the Dedal logo (a blue labyrinth "D" with an orange core), with no text. Click it, or press \`Alt+Shift+S\`, to open the panel; \`⇤\` / \`⇥\` moves both to the other side of the screen. The button exists only where the app renders \`<Devtools />\` — in debug mode; a page without it has no button, no panel and no devtools code.

## node — a single element of the page

\`pick\` and click an element on the page (or select a node in *tree*):
- **component, ID, section, slot** — the ID follows from the position in the block (\`news.0.1\`, \`hero:actions.0\`),
- **selector** — the shortest selector that matches only this node (for patch and bindings), with \`copy\`; \`not unique\` when it can't be pointed to unambiguously,
- **data** — the node's raw data (the API shape) and the binding that assigned it (\`assigned by card\`),
- **issues** — \`resolve\` problems (non-object data, a toProps error) and a component missing from the registry,
- **props** — final props with their origin: \`← default\` (instance defaults), \`← template\` (block), \`← patch <selector>\` (which patch; when several match, the later one wins), \`← data\` (from data through toProps or deep merge), \`← layout\` (from the layout, without details — the page was built without \`trace\`),
- **parent / children** — navigating the tree (hovering highlights, clicking navigates).

Origin applies to top-level props: a patch \`{ style: { height } }\` marks the source of the \`style\` prop. A prop equal to the default value is marked as \`default\` even when the block set the same value — the result is identical then. The suggested selector is computed on the page after \`assign\` — when \`assign\` removed siblings (e.g. a card without data), the \`:nth-child\` position in the block may differ. \`Esc\` cancels \`pick\`.

## tree — the whole page

All sections and nodes in tree order. \`●\` — the node has data, \`!\` — issues or missing from the registry. Sections removed because of data are shown with their layout from before \`assign\` ("removed — no data; layout before assign") — you can see what they were waiting for.

The search field searches in three ways at once: **selector** (the same matcher as patch / bindings — you can test a selector before you put it in your code), **text in the ID, section key and alias** (\`news\`, \`news.0.1\`, \`#featured\`) and **text in the data** (a fragment of a title, an id, a URL — from 2 characters). Data that didn't make it onto the page but contains the text is listed as "not on the page" (with the section, binding and index). Attribute selectors (\`[size=lg]\`) see the props from the layout, not from the data. "only matches" keeps only the matches and their ancestors.

## sections — what went wrong

At the top, page messages, one line per problem: \`✗\` error, \`!\` warning, \`·\` info. Below, each section: where it gets its data from (\`source: page / section / deferred / none\`), its bindings in the form "X data items for Y nodes" and underneath — what came of it and what to do. Hovering over a binding highlights the nodes on the page that received its data; clicking opens *tree* with its selector.

## timing — where the numbers come from

A build in debug mode measures time with the \`performance.now()\` clock at several points. All times in *timing* are in milliseconds **from the start of that build** (rounded to 0.1 ms).

\`\`\`
0 ms                                                               total
├─ layout ─┼──────────────── data loading ──────────────────┼─ assign ─┤
           ├─ page data  ███████████                        │
           ├─ hero       ██████                             │
           └─ related    ████████████████████████████████████  ← slowest
                         query miss ███████  query hit ▏
\`\`\`

**Stages** (the first bar and the legend):
- **layout** — calling \`sections(ctx)\`, turning blocks into nodes (expanding \`repeat\`, IDs), \`remove\` and \`patch\` for all sections. Pure CPU, no IO — usually a fraction of a millisecond. (\`defaults\` are already in the blocks — \`node()\` adds them when the blocks are created.)
- **data loading** — from the end of the layout until **all** loaders have finished (the page's \`data\` and section loaders). Loaders run in parallel, so this stage takes roughly as long as the slowest of them — not as long as their sum.
- **assign** — distributing data to nodes (bindings), \`onShortage\`, \`onEmpty\`. Pure CPU again.
- **total** — the sum of the three stages, i.e. the \`build\` time.

**Loaders** (bars on the timeline): each loader is measured separately — from the call to completion (or error). The bar starts where the loader started and its length is the loader's duration. They all start at the same moment (right after the layout), which is why the bars start evenly. \`page data\` is the page's \`data\` function; the other names are the keys of sections with a loader. \`slowest\` — the loader the whole build is waiting on; red — the loader threw an exception.

**Queries** (under a loader): every \`ui.query\` call during a build in debug mode records its key, cache status, start and duration. How do we know which loader called it? Dedal runs each loader in an async context (\`AsyncLocalStorage\`) carrying its name, and the query reads that context — even after an \`await\`. Thanks to this, two concurrent requests that use the same instance and the same cache don't mix up their queries. In Next \`AsyncLocalStorage\` is global; elsewhere pass \`createDedal({ AsyncLocalStorage })\` from \`node:async_hooks\` — without it *timing* shows only the stages and loaders.

What a query's status and time mean:
- \`miss\` — fetched: not in the cache, or the entry expired (\`maxAge\`); time ≈ the duration of the \`fn\` call (API),
- \`hit\` — from cache, fresh (\`staleTime\` hasn't passed); time ≈ 0,
- \`stale\` — from cache, but past \`staleTime\`: the old result immediately (time ≈ 0), while the refresh runs in the background — **outside the measurement**, the next request will get the fresh one,
- \`bypass\` — a query without a key: always fetched, no cache,
- \`error\` — \`fn\` threw.

Two simultaneous calls with the same key are a single fetch (deduplication): both have the status \`miss\`, and the second one lasts as long as it waited for the first.

## What timing doesn't include

- \`resolve\`, React rendering, sending the HTML to the browser, Next overhead — only \`build\` is measured,
- \`stale\` refreshes in the background,
- **the page cache** — a build with trace bypasses it, so *timing* always shows a full build. In production a page from cache (\`hit\`) doesn't run loaders at all.

That's why the numbers in debug are "the worst case for the page" and "the real state of the query cache". On top of that: \`npm run dev\` mode is slower than a production build, and the first request after the server starts is slower than the following ones (empty query cache, JIT warm-up).

## How to read timing

- **The page is slow** → which loader has \`slowest\`; it determines data loading. Speeding up the others won't help.
- **A long loader with no queries under it** → a slow source outside \`ui.query\` (a direct fetch, a database) — consider \`ui.query\` with \`staleTime\`, \`defer\` or the page cache.
- **The same query is a \`miss\` on every refresh** → \`staleTime: 0\`, the key changes on every request (e.g. it contains a time), or the query has no key (\`bypass\`).
- **Queries in one loader start one after another** (the second starts ≈ when the first ends) → sequential \`await\`s in the loader; if they're independent, use \`Promise.all\`.
- **A red loader** → *sections* will show the error message.

## Common problems

**The panel is empty.** \`No devtools payload on this page\` — the page didn't embed the payload: in debug mode render \`<DevtoolsData payload={inspect(result, resolved)} />\`. \`built without trace — …\` — the payload is there, but the build ran without \`trace\`: missing are item counts, props origin, bindings with no matches and sections removed because of data (see the *Build without trace* case).

**A component doesn't render.** \`✗ card is not in the registry — …\` — the registry doesn't have the component; the node renders the \`fallback\` from \`<Render>\` or nothing. Requires \`<Render debug>\` (the \`data-dedal-missing\` marker).

**A patch doesn't apply.** *sections* → \`! patch “crad” matches no node in this section — it has no effect. Did you mean: card?\` (for \`remove\`: \`… nothing is removed.\`). If the selector matches but the prop has a different value — check the origin in *node*: a later patch or the data may have overridden it.

**A card got no data or disappeared.** *sections* → the section's bindings: \`! card — 2 data items for 4 nodes\` (\`(1 null)\` — some items are \`null\`; without trace: \`2 of 4 nodes filled\`), and underneath the effect: \`2 nodes removed — …\` or \`2 nodes left empty (onShortage: 'keep')\`, and for a surplus \`3 data items not shown — no node left for them:\` with a list.

**Data didn't make it onto the page even though the section received it.** \`✗ crad — 3 data items for 0 nodes\` with \`No node in this section matches “crad” … Did you mean: card?\` (a typo, also in a slot name) or \`“#featured” matches nodes already filled by “card” … Move “#featured” before “card”\` (wrong order of bindings). \`news.2.0 had data, but their parent news.2 was removed\` — the data was lost together with the removed parent.

**Where did this article end up?** *tree* → type a fragment of the title, the id or the URL. Nodes whose data contains it are highlighted in the tree and on the page; if the article didn't make it onto the page — \`! not on the page: section … · card [4] …\`.

**A section isn't on the page.** The page messages in *sections* give the reason: \`failed\` (the loader of an \`optional\` section threw — with the error message), \`removed\` (empty with \`onEmpty: 'remove'\`, a root without data, or \`remove\` in the section definition), \`empty\` (\`kept\` / \`replaced by the onEmpty block\`), \`unknownData\` (data under a key that isn't on the page — with a hint).

**The page shows stale data.** *sections* → \`cache key\`. Debug mode bypasses the page cache, so it shows a fresh build — if the data is up to date in debug but not without it, it's a stale cache entry (\`staleTime\`, \`ui.invalidate()\`).

## Other features

- \`copy report\` — a text report (URL, messages, sections with problems, timings) for a bug report — the same as the "devtools report" on the pages of these docs,
- \`Alt+Shift+S\` opens and closes the panel; \`⇤\` / \`⇥\` moves it to the other side of the screen; the panel remembers whether it was open, the tab and the side within the browser tab (\`sessionStorage\`), even after a reload.

## Limitations and costs (debug mode only)

- **Markers change the DOM** — \`<Render debug>\` wraps every node in \`<dedal-node style="display: contents">\`: CSS selectors that depend on structure (\`.grid > .card\`, \`:first-child\`) may behave differently, and where HTML requires specific children (\`<table>\`, \`<ul>\`, \`<select>\`), the structure breaks.
- **Debug bypasses the page cache** — every request is a full build with API calls.
- **The cost of \`inspect()\` and the payload size** — on the order of a few ms and 150–250 KB for ~500 nodes, a few dozen ms and 1–2 MB for ~4000 nodes; the size depends mainly on the amount of data.
- **A snapshot, not live state** — the panel shows the page as of the server render; it doesn't see client-side changes (component state).
- **Read-only** — the panel doesn't change the layout or the data.

## Programmatically

The same functions are in \`dedal/devtools\` — they work in Node, in tests and in logs:

\`\`\`ts
import { inspect, mergePayloads, pageMessages, reportText, searchNodes, selectNodes } from 'dedal/devtools'

const result = await home.build(ctx, { trace: true })
const payload = inspect(result, ui.resolve(result, { ctx, trace: true }))

payload.nodes['news.0'].selector             // suggested selector
payload.nodes['news.0'].props.size           // { value: 'lg', source: { from: 'patch', selector: '…', section: 'news' } }
payload.sections[0].diagnosis                // unmatched, layout, removed, dropped
selectNodes(payload, 'grid > card')          // IDs of matching nodes — the same matcher as patch / bindings
searchNodes(payload, 'title')                // the *tree* search: { bySelector, byText, byData, lost }
pageMessages(payload)                        // page messages: { level, subject, text, suggestions? }
reportText(payload, { title })               // text report (the same as "copy report")
payload.page.timings                         // timings: [{ scope, total, layout, load, assign, loaders, queries? }]
mergePayloads([pagePayload, sectionPayload]) // page payload + a deferred section
\`\`\`

Example tests: "no binding loses data" — \`expect(pageMessages(payload).filter(m => m.level === 'error')).toEqual([])\`; "the featured card patch matches exactly one node" — \`expect(selectNodes(payload, 'grid > card:first-child')).toHaveLength(1)\`.`,
} as const
