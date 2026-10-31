<p align="center"><img src="logo.svg" width="128" alt="Dedal logo — a labyrinth D on a blueprint grid"></p>

# Dedal

**Change screens without changing code.**

Dedal is the engine behind pages **generated from Figma or assembled in a page builder**, rendered with **your own design system**. Structure, data and components — kept apart, joined at the last moment.

Under the hood it's a TypeScript engine for **server-driven UI**. In a typical component tree three different things are tangled together in one place:

| | What it is | Who changes it, and when |
|---|---|---|
| **Structure** | which blocks, in what order, what goes inside what | designers, editors, experiments, other systems |
| **Data** | what's in the blocks | your APIs, databases, the user |
| **Components** | what a "card" or a "button" looks like | the UI team, a component library |

Dedal keeps them apart. Structure is a template — plain JSON. Data is attached to it by CSS-like selectors, the way CSS attaches styles to HTML. The result is a JSON description of the screen, which the frontend renders with its own registry of components. Each of the three can change on its own schedule, by different people: new structure with the same data, the same data in a new structure, the same description rendered by a different set of components.

Named after Daedalus (Dedal in Polish), the mythical architect: the server designs the page, the frontend builds it.

```
structure (template, JSON) ─┐
                            ├─► Dedal ─► screen description (JSON) ─► registry ─► components
data (your APIs) ───────────┘
```

## Who it is for

Dedal is built for one setup above all: **web products on a shared design system, whose pages are designed in Figma or assembled in a page builder or a CMS** — not written in JSX.

- **Pages from Figma** — designers build a page from the design system's components and publish; a converter turns the frame into a template ([Templates from Figma](https://dawidglosny.github.io/dedal/docs/templates-from-figma/)).
- **Page builders and CMSs** — Dedal is the engine: the contract says what the editor can place and with which props, a template is what it saves, the frontend renders it with your components.
- **Many products, one design system** — templates designed once, served to every product, each rendering them with its registry.

More generally, it fits any UI whose **structure changes on a different schedule, by different people, or comes from a different system than its components**: content sites and landing pages rearranged by editors, dashboards arranged per role or customer, store pages and A/B tests of the page structure.

**Later: mobile apps.** The page is plain JSON a native app could render, but Dedal has no native renderer and no contract versioning yet — see the [roadmap](docs/ROADMAP.md).

It's probably not worth it when:
- the UI is mostly forms, state and interactions (an editor, a checkout) rather than blocks assembled from a known set,
- developers own the structure and it rarely changes — plain components are simpler,
- your problem is **sharing a component library** across apps or frameworks — that's what Web Components or a multi-framework build of your library are for. Dedal doesn't distribute components; it composes screens from the ones you already have.

## A quick look

```ts
// contract.ts — the only thing the server and every frontend share: component → props
import type { Slot } from 'dedal'

export type Contract = {
  grid: { columns?: 1 | 2 | 3 | 4 }
  card: { title?: string; href?: string; badge?: Slot }
  badge: { label?: string }
}
```

```ts
// server: a template (here inline — usually loaded from storage) + data from your API
import { createDedal, type BlockDefinition } from 'dedal'

const ui = createDedal<Contract>()

const newsTemplate = { component: 'grid', props: { columns: 3 }, children: [
  { component: 'card', repeat: 6, slots: { badge: { component: 'badge' } } },
] } satisfies BlockDefinition<Contract>

const home = ui.page({
  sections: [ui.section('news', newsTemplate)],
  data: async () => {
    const articles = await api.latest(6)
    return { news: {
      card: articles.map(a => ({ title: a.headline, href: a.url })),   // each card gets the next article
      'card > :slot(badge)': articles.map(a => ({ label: a.category })), // the badge inside each card gets the next category
    } }
  },
})

const page = ui.resolve(await home.build())   // plain JSON: send it, cache it, render it
```

```tsx
// frontend (React): component names → your components
import { Render, type Registry } from 'dedal/react'

const registry = { grid: Grid, card: Card, badge: Badge } satisfies Registry<Contract>   // missing one = compile error

<Render tree={page} registry={registry} />
```

Change the structure in storage and the page follows — no frontend release (with a page cache: after `ui.invalidate()` or once the entry goes stale). Templates loaded from storage aren't seen by TypeScript — with the contract as a value, `ui.validate` checks them against it — see [Templates as JSON](docs/API.md#templates-as-json).

## What you get

- **Structure is data.** Templates are plain JSON — store them, version them, generate them from Figma. Changing a page doesn't change code.
- **One contract, checked at compile time and at runtime.** Components, props and slots — as a TypeScript type, or as a value with schemas (zod, valibot…) the type is inferred from. Then templates from storage or Figma are validated with paths to every problem (`news.children[2].props.size`), devtools flag mismatches in debug builds, and the contract exports to JSON Schema — for a page builder's property panels or a CMS.
- **Data placed by selectors.** `card`, `#featured`, `card > :slot(badge)`, `card:nth-child(odd)` — CSS syntax you already know, instead of fragile indexes. Adding a heading to a template doesn't shift the data.
- **Explicit rules for missing data.** Fewer articles than cards, an API that fails, an empty section — each case has a default that keeps the page alive and an option to make it strict. Nothing disappears silently: everything is in the report.
- **Variants without copies.** `patch` and `remove` adjust a template per device, site or A/B variant — one template, many versions.
- **Speed.** Page and data-source cache (stale-while-revalidate, no request stampedes, invalidation by prefix), loaders running in parallel, streaming of slow sections. A 530-node page builds and resolves in under 1 ms.
- **Devtools.** A browser panel that shows, for any element on the page, where each prop came from (default, template, patch, data), which selector assigned the data, what got dropped and why, and how long each loader and query took.
- **A bonus: no lock-in.** Because the page is plain JSON, the registry is the only place that knows your components — switching component libraries doesn't touch the pages, and the zero-dependency core works with any renderer (React included; [Web Components](examples/web-components) in a few lines).

## Size and speed

| | |
|---|---|
| `dedal/react` in the browser | **0.6 KB** min + gzip (`<Render>` alone: 0.5 KB); React itself is a peer dependency |
| `dedal` core | 10 KB min + gzip (with validation and JSON Schema export), **zero dependencies** — in the browser only if you run `resolve` there |
| devtools panel | 12.6 KB min + gzip — a separate chunk, fetched only when `<Devtools />` mounts (debug mode) |
| build + resolve, 530 nodes | **0.8 ms** |
| build + resolve, 3620 nodes | 6.5 ms |
| tests | 363 (vitest) |

Timings from `npm run bench` on an Apple M-series laptop, Node 22 — run it on your machine. Sizes: the published ESM entry points, bundled and minified with esbuild, React external.

## How it compares

Dedal doesn't replace your framework or your components — it decides **what** is on the page; they decide **how** it looks and behaves. It is not a way to distribute a component library: if your problem is sharing components across apps or frameworks, use Web Components or build your library for each framework.

| | What it solves | Relation to Dedal |
|---|---|---|
| **React Server Components** | **where** React runs: on the server, with less JavaScript in the browser | Complementary. Dedal builds the page, RSC can render it — that's exactly what [`examples/next`](examples/next) does. RSC doesn't say anything about where the layout comes from. |
| **Web Components, multi-framework UI libraries** | **sharing components** across apps and frameworks | A different problem. Dedal doesn't ship or share components — it uses the ones you have, Web Components included: they can be the registry, and Dedal slots map to native `<slot>`s ([`examples/web-components`](examples/web-components)). |
| **Headless CMS, page builders** | editing content (and sometimes layouts) in a UI | Can be the source of templates and data. Dedal is the typed engine in between: contract, data binding, missing-data rules, cache, devtools. It has no editor of its own. |
| **Hand-made JSON + a `switch` over components** | the same idea, done ad hoc | What Dedal replaces. The ad-hoc version usually grows its own data binding, IDs, cache and debugging — Dedal has them, typed and tested. |

## Installation

```bash
npm i github:dawidglosny/dedal#v0.7.0
```

Requires Node 20.9+. React 18+ only for `dedal/react` (an optional peer dependency). The package builds on install.

| Entry point | Contents |
|---|---|
| `dedal` | the core: `createDedal`, pages, sections, `resolve`, cache |
| `dedal/react` | `<Render>` — the React renderer (works in Server Components, SSR and on the client) |
| `dedal/devtools` | `inspect()` and text reports, for tests and logs |
| `dedal/react/devtools` | `<Devtools />` — the browser panel |
| `dedal/devtools/panel` | `mountDevtools()` — the panel outside React |
| `dedal/figma` | `mapping()` — Figma frames to templates, checked against the contract; the `dedal-figma pull` CLI |

## Documentation

- **Quick start** — [a rendered page in five files](https://dawidglosny.github.io/dedal/docs/quick-start/): install, a contract, a page, a registry, render in Next.js or plain Node.
- **Guide** — **[dawidglosny.github.io/dedal](https://dawidglosny.github.io/dedal/)**: why Dedal, how it works, a tutorial (ending with a template edited without a release), the same engine in another domain (a dashboard), and every feature, warning and error as a live page with its code, result and devtools report.
- **Limitations** — [what Dedal doesn't do (yet)](https://dawidglosny.github.io/dedal/docs/limitations/).
- **Decisions** — [docs/adr](docs/adr): the positioning, the scope, and every larger decision with its alternatives.
- **API reference** — [on the site](https://dawidglosny.github.io/dedal/docs/api/) (source: [docs/API.md](docs/API.md)): formats, design rules, every option; every exported function and type in the [type reference](https://dawidglosny.github.io/dedal/types/), generated from the source.
- **Examples**
  - [`examples/next`](examples/next) — Next.js: one page, two component libraries (Radix Themes and shadcn/ui), cache, streaming, devtools,
  - [`examples/web-components`](examples/web-components) — a JSON template, a plain Node server, custom elements in the browser.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — setup, where things are, the docs site and the examples, what a pull request needs.

## Status

Version **0.7.0**. The API may still change before 1.0 — see [CHANGELOG.md](CHANGELOG.md). Plans (an Astro renderer, pruning empty containers, cache adapters): [docs/ROADMAP.md](docs/ROADMAP.md).
