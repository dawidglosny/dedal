# Dedal × Web Components

The same idea as [`examples/next`](../next), without React: the page template is a **JSON file** (as if exported from a design tool), the server adds data and sends the finished page as JSON, and the browser renders it with **custom elements** — a tiny design system with shadow DOM and native `<slot>`s.

```bash
npm run dedal   # build the package → npm pack → install from vendor/
npm start       # bundle the client, start the server on http://localhost:3000
```

- `/` — the page; `/?device=mobile` — the mobile variant (one column, three cards),
- `/api/home?device=desktop|mobile` — the page as JSON (`ResolvedPage`), what the browser renders; the deferred section "For you" comes as a placeholder,
- `/api/section?key=forYou&device=…` — that section on its own (`page.section()`), fetched by the browser after the page.

## Try it: change the layout without touching the code

With the server running, open `templates/home.json` and edit it — then reload the page:
- put `"news"` before `"hero"` — the sections swap places,
- change `"columns": 3` to `2` and `"repeat": 6` to `4` — two columns, four cards,
- change `"heading": "Latest"` to anything else.

No restart, no build, no change to the server or browser code: the server watches the file and drops the cached pages when it changes (`ui.invalidate`). The data loader still fills the cards, because it finds them by the selector `card`, not by position. Now write `"component": "carousel"` somewhere, or `"columns": 6`: the template fails validation against the contract and `/api/home` answers with the reason (`news.children[0].children[0].component: unknown component "carousel"`) instead of rendering a broken page.

In a real project the file is a database row, a CMS entry or a design-tool export, and editors change it — the frontend team doesn't release anything.

## Structure

| File | Role |
|---|---|
| `src/contract.ts` | the contract as a value (`defineContract`, zod schemas): components, props, slots — the type is inferred from it; shared by the server and the browser |
| `templates/home.json` | the page template: one block per section, plain JSON — no code |
| `src/templates.ts` | reads the template file and checks it against the contract (`ui.validateSections`) |
| `src/ui.ts`, `src/home.page.ts` | the instance (`createDedal({ contract, toProps })`); the page: async `sections` from the template file, a mobile variant (`patch`, `remove`), data bindings, cache dropped when the file changes |
| `src/server.ts` | `node:http`: the page as JSON and the static files |
| `client/components.ts` | the design system: `ds-hero`, `ds-card`, `ds-badge`… — they know nothing about Dedal |
| `client/registry.ts` | contract → tag names (`satisfies Registry<Contract>`: a missing component is a compile error) |
| `client/render.ts` | the renderer — about 20 lines: props → element properties, slots → `slot="name"`, children → the default slot; `replaceSection` for deferred sections |
| `client/main.ts` | fetches the page, renders it, then fetches and swaps in the deferred sections |

## What the example shows

**Layout as data.** The template is a JSON file, not TypeScript, read inside the page definition on every build (`sections` is async) and checked against the contract, which is a value with schemas — the same contract types the server code and the browser's registry. Pages are cached; changing the file drops them (`ui.invalidate`), like a publish would.

**Web Components are a registry, not an alternative.** Web Components make a component work in any framework; Dedal decides which components make up the page and with what data. Here they meet in the registry: component name → tag. A Dedal slot maps directly onto a native named `<slot>`.

**A deferred section without `<Suspense>`.** "For you" is slow (800 ms) and marked `defer`, so the page arrives without it, with a `skeleton` placeholder from the contract. The browser renders the page, then fetches every section with `deferred: true` from `/api/section` and swaps it in (`replaceSection` in `client/render.ts`). If the section's own request returns no section — its loader failed (it is `optional`) or it was empty — the placeholder is removed.

**Framework independence in practice.** The core (`build`, `resolve`) has no idea what renders the result. The same `ResolvedPage` could be rendered by `dedal/react`, by this renderer, or by a mobile app.

## Notes

- `defaults` from `createDedal` apply to JSON templates too — they are merged in when the page is built, not when a block is created. This example sets its props in the template on purpose, to keep the file self-explanatory.
- Props become element **properties**, so the contract avoids names that `HTMLElement` already has (`title`, `hidden`…): `heading` instead of `title`.
- The page is rendered in the browser after `fetch`. Server-side HTML is possible (Declarative Shadow DOM), but out of scope here.
