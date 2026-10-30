# Dedal × Next.js — Radix Themes and shadcn/ui

The same page (contract, template, data) rendered with two component libraries. Only the registry differs.

```bash
npm run dedal   # build the package → npm pack → install from vendor/ (a single copy of React, as for a consumer)
npm run build && npm start
```

- `/shadcn` — shadcn/ui (Tailwind v4, components in `components/ui`),
- `/radix` — Radix Themes (`@radix-ui/themes`),
- `?device=desktop|mobile` — `ctx.device` (number of columns, featured card),
- `?debug=1` — the devtools panel (the "dedal" button in the bottom-right corner: "pick" a page element, tree, sections, live selector) and a view from `inspect()` (`dedal/devtools`): sections and data sources, cache key, node tree with suggested selectors, prop origin (default / template / patch / data), assignments; a build with `trace` bypasses the cache,
- `/api/home?device=mobile` — the same page as JSON (middleware → front end topology).
- `/docs` — documentation by example: every feature, warning and error as a separate page with a description, code, result and devtools report (see below).

## Structure

| File | Role |
|---|---|
| `ui/contract.ts` | contract: Radix/shadcn vocabulary, neutral values (`sm \| md \| lg`, `default \| secondary \| outline`) |
| `ui/to-props.ts` | API data → contract props (knows nothing about the libraries) |
| `ui/home.page.ts` | blocks and page: slots `media`, `actions`, `badge`, `footer`, data into slots via selectors, `cache` |
| `ui/registries/shadcn.tsx` | contract → shadcn components + Tailwind classes |
| `ui/registries/radix-themes.tsx` | contract → Radix Themes components and their scales (`size="1".."9"`, `variant="soft"`…) |
| `ui/docs/*.cases.ts` | documentation cases grouped as in the menu (layout, data, sections, cache, rendering, errors, devtools); the code shown on the page is the `// #region <slug>` region from these files |
| `ui/docs/doc-view.tsx`, `ui/docs/run.ts` | case page: build with `trace`, `resolve`, devtools report or the caught exception |
| `ui/page-view.tsx` | shared view: `build` → `resolve` → `<Render registry={...}>` |
| `components/ui/*` | shadcn components (card, badge, button, tabs, avatar, separator) — code in the project, as after `shadcn add` |
| `app/(shadcn)`, `app/(radix)` | separate root layouts: Tailwind and Radix Themes styles don't mix |

The components in `components/ui` were rewritten by hand from the shadcn/ui sources (new-york style, Tailwind v4, the `radix-ui` package).
They can be generated officially: `npx shadcn@latest add card badge button tabs avatar separator`.

## What the example shows

- **One contract, two libraries** — `satisfies Registry<Contract>` ensures both registries have all components and matching props.
- **Translating values in the registry** — `badge.variant: 'secondary'` is `variant="secondary"` in shadcn and `variant="soft"` in Radix; `grid.gap: 'md'` is `gap-6` or `gap="4"`.
- **Slots** — hero (`media`, `actions` as a list of buttons), card (`badge`, `footer` with the author's avatar).
- **Data into slots via selectors** — `'card > :slot(badge)': categories`, `'card > :slot(footer)': authors`.
- **`remove` in a section** — "More" removes card footers (`card > :slot(footer)`), 5 articles for 8 places → 3 cards disappear.
- **Cache** — `ui.page({ ..., cache: { key: ctx => ['home', ctx.device] } })`: the page from memory (fresh for 5 s), then refreshed in the background (the loader has an artificial 20 ms delay like an API).
- **Query** — `articlesQuery` (`ui.query`): articles cached in the instance, shared by the page and the deferred section.
- **Deferred section** — "For you" (`defer`): the page goes out immediately with a placeholder, and the section (slow API, 600 ms) is streamed in via `<Suspense>` (`ui/page-view.tsx`).
- **RSC + client components** — the renderer runs on the server; the tabs (Radix Tabs) are interactive on the client.

## Documentation by example (`/docs`)

A step-by-step tutorial, then every package feature, every warning and every error as a separate page — grouped in the menu on the left:

| Group | Cases |
|---|---|
| Tutorial | 12 steps: a site's home page from the contract, through data, slots, shared sections, variants, patch, missing data, streaming, query and cache, to render and devtools; step 13 — a debugging exercise (5 hidden mistakes, tasks with solutions) |
| Layout | blocks and `repeat`, slots, aliases, `patch` and selectors, patch without matches, `remove`, removing a section root, `ctx` variants |
| Data | bindings, `toProps` and `defaults`, `null` items, shortages (`onShortage: 'remove'` / `'keep'`), surplus, binding without matches, binding order, dropped |
| Sections | section loader vs page `data`, `optional` and `onSectionError`, `onEmpty` (`remove` / `keep` / block), `required`, `defer` (streaming), `unknownData`, loader without `return` |
| Cache & queries | page cache, `undefined` key, query statuses (`miss` / `hit` / `stale` / `bypass`), `invalidate` |
| Rendering | component missing from the registry, non-object data, exception in `toProps`, `toProps` returns a non-object, data without a node, `onIssue: 'throw'` |
| Errors (thrown) | every exception that aborts a build or `resolve` — with the message text |
| Devtools | panel, timing, build without `trace` |

Each group has an introduction page (`/docs/layout`, `/docs/data`…): why this part exists, how it works, why it is designed this way, how to use it and what to watch out for — and `/docs` (Introduction) is the starting point for someone new: what server-driven UI is and what problem it solves, what Dedal does, the server / front end split of roles, how data flows, an example from the page definition through JSON (`PageResult`, `ResolvedPage`) to render, a glossary, common tasks (e.g. adding a new component). Content: `ui/docs/intros.ts`. The pages are read in order (the "next" link at the bottom: the group introduction, then its cases).

Case page: a description (what it is, when it appears, what to do), a "See it live" box — what to open in the devtools panel and what to look for there (`ui/docs/live.ts`; for cases with an exception — why the panel is empty), the code (a region from `ui/docs/*.cases.ts` — the same one that runs), the result (Radix Themes), the devtools report (the same as "copy report" in the panel) or the caught exception. The dot next to a case in the menu: green — works, yellow — warning in devtools, red — error in devtools, purple — the build throws an exception. The devtools panel is enabled on every page.

## Known differences between the libraries

- Radix Themes renders the avatar fallback (initials) only after hydration — in the server HTML `rt-AvatarFallback` is empty. shadcn renders the initials already on the server.
