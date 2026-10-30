# Dedal × Next.js — Radix Themes and shadcn/ui

The same page (contract, template, data) rendered with two component libraries. Only the registry differs.

```bash
npm install            # in the repository root (the package build needs its dev dependencies)
cd examples/next
npm run dedal          # build the package → npm pack → install from vendor/ (a single copy of React, as for a consumer)
npm run dev            # or: npm run build && npm start
```

Run `npm run dedal` instead of `npm install` — it also installs the remaining dependencies. A plain `npm install` fails until `vendor/dedal.tgz` exists. Run `npm run dedal` again after every change in the package sources.

- `/shadcn` — shadcn/ui (Tailwind v4, components in `components/ui`),
- `/radix` — Radix Themes (`@radix-ui/themes`),
- `?device=desktop|mobile` — `ctx.device` (number of columns, featured card),
- `?debug=1` — the devtools panel (the "dedal" button in the bottom-right corner: "pick" a page element, tree, sections, live selector) and a view from `inspect()` (`dedal/devtools`): sections and data sources, cache key, node tree with suggested selectors, prop origin (default / template / patch / data), assignments; a build with `trace` bypasses the cache,
- `/api/home?device=mobile` — the same page as JSON (middleware → front end topology).

## Structure

| File | Role |
|---|---|
| `ui/contract.ts` | contract: Radix/shadcn vocabulary, neutral values (`sm \| md \| lg`, `default \| secondary \| outline`) |
| `ui/to-props.ts` | API data → contract props (knows nothing about the libraries) |
| `ui/home.page.ts` | blocks and page: slots `media`, `actions`, `badge`, `footer`, data into slots via selectors, `cache` |
| `ui/registries/shadcn.tsx` | contract → shadcn components + Tailwind classes |
| `ui/registries/radix-themes.tsx` | contract → Radix Themes components and their scales (`size="1".."9"`, `variant="soft"`…) |
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

## Documentation

The documentation by example — a tutorial and every feature, warning and error as a live page — is a separate app in [`site`](../../site), published at https://dawidglosny.github.io/dedal/. It uses the same contract, instance and Radix Themes registry as this example.

## Known differences between the libraries

- Radix Themes renders the avatar fallback (initials) only after hydration — in the server HTML `rt-AvatarFallback` is empty. shadcn renders the initials already on the server.
