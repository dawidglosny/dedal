# Dedal

**Store page layouts as data on the server. Fill them with content. Let any frontend render them with its own components.**

Dedal is a TypeScript library for **server-driven UI**. The server keeps a template of a page — which components, in what order, with which settings — as plain JSON, fills it with data from your APIs and sends the finished page to the frontend. The frontend only maps component names to its components and renders. It doesn't know which page it is showing or where the data came from.

Named after Daedalus (Dedal in Polish), the mythical architect: the server designs the page, the frontend builds it.

```
design tool / editor ─► template (JSON) ─► server: + data ─► page (JSON) ─► frontend: name → component
                                             Dedal                           React, Web Components, a mobile app…
```

## Who is it for

Dedal was born from a real setup: **many content sites built on one design system**, where page templates are designed in a design tool, exported, stored on the server and served to the sites. Nobody writes the layout of a home page in JSX — it is data, and it changes far more often than the components do.

It fits when:
- **layouts change more often than components** — editors, designers or A/B tests rearrange pages, and you don't want a frontend release for every change,
- **layouts come from outside the code** — a design-tool export, a page editor, a CMS, a database,
- **one page has several frontends** — web and a mobile app, or several sites sharing one design system, each with its own component library,
- **you want to swap the component library** without touching the pages — only the mapping (registry) changes.

It's probably not worth it when:
- the UI is mostly forms, state and interactions (a dashboard, an editor, a checkout) rather than content assembled from blocks,
- there is one frontend, the developers own the layout, and it rarely changes — plain components in your framework are simpler,
- the team is small and the layout lives in one repository anyway: Dedal adds a layer (a contract, a registry) that pays off only with more sites, more frontends or non-developers editing pages.

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
      'card > :slot(badge)': articles.map(a => ({ label: a.category })), // CSS-like selectors, not indexes
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

The same `page` can be rendered by Web Components ([`examples/web-components`](examples/web-components)) or by a mobile app with its own registry.

## What you get

- **The layout is data.** Templates are plain JSON — store them, version them, generate them from a design tool. Changing a page doesn't change code.
- **One contract, typed end to end.** A TypeScript type lists components and their props. Templates written in code (`ui.node()`) and registries are checked against it at compile time.
- **Data finds its place by selectors.** `card`, `#featured`, `card > :slot(badge)`, `card:nth-child(odd)` — CSS syntax you already know, instead of fragile indexes. Adding a heading to a template doesn't shift the data.
- **Explicit rules for missing data.** Fewer articles than cards, an API that fails, an empty section — each case has a default that keeps the page alive and an option to make it strict. Nothing disappears silently: everything is in the report.
- **Variants without copies.** `patch` and `remove` adjust a template per device, site or A/B variant — one template, many versions.
- **Component library independence.** The registry is the only place that knows your components. Moving from one library to another is a change to the registry, not to the pages.
- **Framework independence.** The core has zero dependencies and runs in Node, on the edge and in the browser. React renderer included; any other is a small function over a JSON tree.
- **Built-in performance tools.** Page and data-source cache (stale-while-revalidate, no request stampedes, invalidation by prefix), loaders running in parallel, streaming of slow sections. A 530-node page builds and resolves in under 1 ms.
- **Devtools.** A browser panel that shows, for any element on the page, where each prop came from (default, template, patch, data), which selector assigned the data, what got dropped and why, and how long each loader and query took.

## How it compares

Dedal doesn't replace your framework or your components — it decides **what** to render; they decide **how**.

| | What it solves | Relation to Dedal |
|---|---|---|
| **React Server Components** | **where** React runs: on the server, with less JavaScript in the browser | Complementary. Dedal builds the page, RSC can render it — that's exactly what [`examples/next`](examples/next) does. RSC doesn't say anything about where the layout comes from. |
| **Web Components** | a **component** that works in any framework | Complementary. Web Components can be the registry: Dedal slots map to native `<slot>`s ([`examples/web-components`](examples/web-components)). |
| **Headless CMS, page builders** | editing content (and sometimes layouts) in a UI | Can be the source of templates and data. Dedal is the typed engine in between: contract, data binding, missing-data rules, cache, devtools. It has no editor of its own. |
| **Hand-made JSON + a `switch` over components** | the same idea, done ad hoc | What Dedal replaces. The ad-hoc version usually grows its own data binding, IDs, cache and debugging — Dedal has them, typed and tested. |

## Installation

```bash
npm i github:dawidglosny/dedal#v0.6.1
```

Requires Node 20.9+. React 18+ only for `dedal/react` (an optional peer dependency). The package builds on install.

| Entry point | Contents |
|---|---|
| `dedal` | the core: `createDedal`, pages, sections, `resolve`, cache |
| `dedal/react` | `<Render>` — the React renderer (works in Server Components, SSR and on the client) |
| `dedal/devtools` | `inspect()` and text reports, for tests and logs |
| `dedal/react/devtools` | `<Devtools />` — the browser panel |
| `dedal/devtools/panel` | `mountDevtools()` — the panel outside React |

## Documentation

- **Guide** — **[dawidglosny.github.io/dedal](https://dawidglosny.github.io/dedal/)**: why Dedal, how it works, a 12-step tutorial, and every feature, warning and error as a live page with its code, result and devtools report.
- **API reference** — [docs/API.md](docs/API.md): formats, design rules, every option.
- **Examples**
  - [`examples/next`](examples/next) — Next.js: one page, two component libraries (Radix Themes and shadcn/ui), cache, streaming, devtools,
  - [`examples/web-components`](examples/web-components) — a JSON template, a plain Node server, custom elements in the browser,
  - [`examples/custom-ds`](examples/custom-ds) — a larger page on a custom design system: shared sections, device variants, data-dependent sections.

## Status

Version **0.6.1**. The API may still change before 1.0 — see [CHANGELOG.md](CHANGELOG.md). Plans (an Astro renderer, pruning empty containers, cache adapters): [docs/ROADMAP.md](docs/ROADMAP.md).
