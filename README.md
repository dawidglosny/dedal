<p align="center"><img src="logo.svg" width="128" alt="Dedal logo — a labyrinth D on a blueprint grid"></p>

# Dedal

**Change screens without changing code.**

Dedal is the engine behind pages **generated from Figma or assembled in a page builder**, rendered with **your own design system**. The structure of a page is stored as JSON, apart from your data and your components, and the three meet only when the page is built.

How it works: in a typical component tree three different things are tangled together in one place —

| | What it is | Who changes it, and when |
|---|---|---|
| **Structure** | which blocks, in what order, what goes inside what | designers, editors, experiments, other systems |
| **Data** | what's in the blocks | your APIs, databases, the user |
| **Components** | what a "card" or a "button" looks like | the UI team, a component library |

Dedal keeps them apart. Structure is a template — plain JSON. Data is attached to it by CSS-like selectors, the way CSS attaches styles to HTML. The result is a JSON description of the screen, which the frontend renders with its own registry of components. Each of the three can change on its own schedule, by different people: new structure with the same data, the same data in a new structure, the same description rendered by a different set of components.

The pattern is known as server-driven UI: the server sends a description of the screen, the frontend renders it with its own components. Named after Daedalus (Dedal in Polish), the mythical architect: the server designs the page, the frontend builds it.

```
structure (template, JSON) ─┐
                            ├─► Dedal ─► screen description (JSON) ─► registry ─► components
data (your APIs) ───────────┘
```

## Who it is for

Dedal is built for one setup above all: **web products on a shared design system, whose pages are designed in Figma or assembled in a page builder or a CMS** — not written in JSX.

- **Pages from Figma** — designers build a page from the design system's components and publish; `dedal-figma pull` (or an agent, through the `dedal-mcp` server) turns the frame into a template checked against the contract ([a working example](examples/figma), [the guide](https://dawidglosny.github.io/dedal/docs/templates-from-figma/)).
- **Page builders and CMSs** — Dedal is the engine: the contract says what the editor can place and with which props, a template is what it saves, the frontend renders it with your components.
- **Many products, one design system** — templates designed once, served to every product, each rendering them with its registry.

More generally, it fits any UI whose **structure changes on a different schedule, by different people, or comes from a different system than its components**: content sites and landing pages rearranged by editors, dashboards arranged per role or customer, store pages and A/B tests of the page structure.

**Later: mobile apps.** The page is plain JSON a native app could render, but Dedal has no native renderer and no contract versioning yet — see the [roadmap](docs/ROADMAP.md).

It's probably not worth it when:
- the UI is mostly forms, state and interactions (an editor, a checkout) rather than blocks assembled from a known set,
- developers own the structure and it rarely changes — plain components are simpler,
- your problem is **sharing a component library** across apps or frameworks — that's what Web Components or a multi-framework build of your library are for. Dedal doesn't distribute components; it composes screens from the ones you already have.

## From Figma

Designers build the page from the design system's components — sections included, their content in native Figma slots. A mapping says where Figma's names differ from the contract; everything else follows the convention:

```js
// figma.mapping.mjs
import { component, image, mapping, swap } from 'dedal/figma'
import { contract } from './contract.mjs'

export default mapping(contract, {
  feature: component('FeatureCard', { icon: swap('Icon', name => name.replace('icon/', '')) }),
  image: component('Image', { src: image() }),
}, { section: 'section', text: 'text' })
```

```text
$ FIGMA_TOKEN=… npx dedal-figma pull "https://www.figma.com/design/…?node-id=31-398" --mapping ./figma.mapping.mjs --out templates/home.json --images public/figma
1 layer(s) not in the template:
  Frame 427/Group 12/icon/lock-open — an instance of "icon/lock-open", which no contract component maps
3 image(s) → public/figma
✓ 10 section(s) → templates/home.json
```

- **Validation stops the pull** — a variant the code doesn't have, a prop of the wrong type: nothing is written, and the error names the template path and the Figma layer.
- **Every layer left out is listed** — with its Figma path and the reason; nothing is dropped silently.
- **The page follows the design** — the frontend renders the template with your components; change the frame, pull again, reload.
- **With an agent** — `dedal-mcp` (an MCP server) and a Claude Code skill (`skills/figma-to-dedal`) run the same pull and sort its report.
- **The design system next to the code** — `dedal-figma audit` lists the Figma components that match the contract, drifted from it, or are missing in the code; `dedal-figma component` proposes the contract entry for one, with the questions to answer (and the `figma-component-to-code` skill writes it).
- **And back to Figma** — `dedal-figma build` turns a template into a frame of the Figma file, from its library components, through the Dedal plugin (`figma-plugin/`); the `page-to-dedal` skill composes that template from a description of the page.

See [`examples/figma`](examples/figma) and [*A page from Figma, end to end*](https://dawidglosny.github.io/dedal/docs/figma-demo/).

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

Change the structure in storage and the page follows — no frontend release. If the page is cached, it updates after `ui.invalidate()` or when the entry goes stale. Templates loaded from storage aren't seen by TypeScript — with the contract as a value, `ui.validate` checks them against it — see [Templates as JSON](docs/API.md#templates-as-json).

## What you get

- **Structure is data.** Templates are plain JSON — store them, version them, generate them from Figma. Changing a page doesn't change code.
- **One contract, checked at compile time and at runtime.** Components, props and slots, typed at compile time. Written as a value with schemas (zod, valibot…), it also validates templates from Figma or storage at runtime — with a path to every problem (`news.children[2].props.size`) — flags mismatches in devtools, and exports to JSON Schema for a page builder's property panels or a CMS.
- **Data placed by selectors.** `card`, `#featured`, `card > :slot(badge)`, `card:nth-child(odd)` — CSS syntax you already know, instead of fragile indexes. Adding a heading to a template doesn't shift the data.
- **Explicit rules for missing data.** Fewer articles than cards, an API that fails, an empty section — each case has a default that keeps the page alive and an option to make it strict. Nothing disappears silently: everything is in the report.
- **Variants without copies.** `patch` and `remove` adjust a template per device, site or A/B variant — one template, many versions.
- **Speed.** Page and data-source cache (stale-while-revalidate, no request stampedes, invalidation by prefix), loaders running in parallel, streaming of slow sections. A 530-node page builds and resolves in under a millisecond.
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
| tests | 405 (vitest) |

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
npm i github:dawidglosny/dedal#v0.9.1
```

Requires Node 20.9+. React 18+ only for `dedal/react` (an optional peer dependency). The package builds on install.

| Entry point | Contents |
|---|---|
| `dedal` | the core: `createDedal`, pages, sections, `resolve`, cache |
| `dedal/react` | `<Render>` — the React renderer (works in Server Components, SSR and on the client) |
| `dedal/devtools` | `inspect()` and text reports, for tests and logs |
| `dedal/react/devtools` | `<Devtools />` — the browser panel |
| `dedal/devtools/panel` | `mountDevtools()` — the panel outside React |
| `dedal/figma` | `mapping()` — Figma frames to templates, checked against the contract; the `dedal-figma` CLI (`pull`, `audit`, `component`, `build`), the `dedal-mcp` server for agents, the Dedal Figma plugin (`figma-plugin/`) and Claude Code skills (`skills/`) |

## Documentation

- **Quick start** — [a rendered page in five files](https://dawidglosny.github.io/dedal/docs/quick-start/): install, a contract, a page, a registry, render in Next.js or plain Node.
- **Guide** — **[dawidglosny.github.io/dedal](https://dawidglosny.github.io/dedal/)**: why Dedal, how it works, a tutorial (ending with a template edited without a release), the same engine in another domain (a dashboard), and every feature, warning and error as a live page with its code, result and devtools report.
- **From Figma** — [the Figma section](https://dawidglosny.github.io/dedal/docs/templates-from-figma/) — an overview, preparing a Figma file, the mapping, the CLI, the MCP server and the skill — and [A page from Figma, end to end](https://dawidglosny.github.io/dedal/docs/figma-demo/) (the example, file by file).
- **Limitations** — [what Dedal doesn't do (yet)](https://dawidglosny.github.io/dedal/docs/limitations/).
- **Decisions** — [docs/adr](docs/adr): the positioning, the scope, and every larger decision with its alternatives.
- **API reference** — [on the site](https://dawidglosny.github.io/dedal/docs/api/) (source: [docs/API.md](docs/API.md)): formats, design rules, every option; every exported function and type in the [type reference](https://dawidglosny.github.io/dedal/types/), generated from the source.
- **Examples**
  - [`examples/figma`](examples/figma) — a landing page designed in Figma, pulled by `dedal-figma` and rendered by Dedal: change the frame, pull, the page follows,
  - [`examples/next`](examples/next) — Next.js: one page, two component libraries (Radix Themes and shadcn/ui), cache, streaming, devtools,
  - [`examples/web-components`](examples/web-components) — a JSON template, a plain Node server, custom elements in the browser.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — setup, where things are, the docs site and the examples, what a pull request needs.

## Status

Version **0.9.1**. The API may still change before 1.0 — see [CHANGELOG.md](CHANGELOG.md). Plans (a Figma plugin, a page builder example, an Astro renderer, pruning empty containers, cache adapters): [docs/ROADMAP.md](docs/ROADMAP.md).
