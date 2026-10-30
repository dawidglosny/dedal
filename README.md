# Dedal

**Let editors, designers and experiments change page layouts — without a frontend release.**

Dedal is a TypeScript engine for **server-driven UI**. A page's layout — which components, in what order, with which settings — is a template stored on the server as plain JSON. Dedal fills it with data from your APIs and sends the finished page to the frontend, which only maps component names to the components it already has. Rearranging a page becomes a data change, not a code change.

Named after Daedalus (Dedal in Polish), the mythical architect: the server designs the page, the frontend builds it.

```
design tool / editor ─► template (JSON) ─► server: + data ─► page (JSON) ─► frontend: name → component
                                             Dedal
```

## Who is it for

The question isn't how big the company is or how many frameworks it uses. It's **how often page layouts change, and who changes them**. Dedal is for products where the layout changes more often than the components, and the people changing it don't ship code:

- **Media and content sites** — editors rearrange the home page every day, add special sections, build themed editions.
- **Many sites on one design system** — templates designed in a design tool, exported, stored on the server and served to every site. This is the setup Dedal was born from: nobody writes a home page layout in JSX; it is data.
- **E-commerce and marketing** — landing pages, seasonal campaigns, A/B tests of the layout, run by marketers rather than developers.
- **Mobile apps** — the most common home of server-driven UI: a layout change in a native app means a store release and waiting for users to update. Dedal's output is plain JSON, so a native app can render it with its own registry (Dedal ships a React renderer; a native one is up to the app).

It's probably not worth it when:
- the UI is mostly forms, state and interactions (a dashboard, an editor, a checkout) rather than content assembled from blocks,
- developers own the layout and it rarely changes — plain components in your framework are simpler,
- your problem is **sharing a component library** across apps or frameworks — that's what Web Components or a multi-framework build of your library are for. Dedal doesn't distribute components; it composes pages from the ones you already have.

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

Change the template in storage and the page follows — no frontend release (with a page cache: after `ui.invalidate()` or once the entry goes stale).

## What you get

- **The layout is data.** Templates are plain JSON — store them, version them, generate them from a design tool. Changing a page doesn't change code.
- **One contract, typed end to end.** A TypeScript type lists components and their props. Templates written in code (`ui.node()`) and registries are checked against it at compile time.
- **Data finds its place by selectors.** `card`, `#featured`, `card > :slot(badge)`, `card:nth-child(odd)` — CSS syntax you already know, instead of fragile indexes. Adding a heading to a template doesn't shift the data.
- **Explicit rules for missing data.** Fewer articles than cards, an API that fails, an empty section — each case has a default that keeps the page alive and an option to make it strict. Nothing disappears silently: everything is in the report.
- **Variants without copies.** `patch` and `remove` adjust a template per device, site or A/B variant — one template, many versions.
- **Built-in performance tools.** Page and data-source cache (stale-while-revalidate, no request stampedes, invalidation by prefix), loaders running in parallel, streaming of slow sections. A 530-node page builds and resolves in under 1 ms.
- **Devtools.** A browser panel that shows, for any element on the page, where each prop came from (default, template, patch, data), which selector assigned the data, what got dropped and why, and how long each loader and query took.
- **A bonus: no lock-in.** Because the page is plain JSON, the registry is the only place that knows your components — switching component libraries doesn't touch the pages, and the zero-dependency core works with any renderer (React included; [Web Components](examples/web-components) in a few lines).

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
