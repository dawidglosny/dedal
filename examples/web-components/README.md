# Dedal × Web Components

The same idea as [`examples/next`](../next), without React: the page template is a **JSON file** (as if exported from a design tool), the server adds data and sends the finished page as JSON, and the browser renders it with **custom elements** — a tiny design system with shadow DOM and native `<slot>`s.

```bash
npm run dedal   # build the package → npm pack → install from vendor/
npm start       # bundle the client, start the server on http://localhost:3000
```

- `/` — the page; `/?device=mobile` — the mobile variant (one column, three cards),
- `/api/home?device=desktop|mobile` — the page as JSON (`ResolvedPage`), what the browser renders.

## Structure

| File | Role |
|---|---|
| `src/contract.ts` | the contract: components and their props — shared by the server and the browser; plus the runtime list of component names |
| `templates/home.json` | the page template: one block per section, plain JSON — no code |
| `src/templates.ts` | loads and validates templates (unknown component = error at startup) |
| `src/ui.ts`, `src/home.page.ts` | the instance with `toProps`; the page: sections from the templates, a mobile variant (`patch`, `remove`), data bindings, cache |
| `src/server.ts` | `node:http`: the page as JSON and the static files |
| `client/components.ts` | the design system: `ds-hero`, `ds-card`, `ds-badge`… — they know nothing about Dedal |
| `client/registry.ts` | contract → tag names (`satisfies Registry<Contract>`: a missing component is a compile error) |
| `client/render.ts` | the renderer — about 20 lines: props → element properties, slots → `slot="name"`, children → the default slot |

## What the example shows

**Layout as data.** The template is a JSON file, not TypeScript. In a real project it lives in a database or comes from a design tool export — the server code doesn't change when the layout does. Because the contract is types only, templates from outside the code are validated at runtime (`src/templates.ts`).

**Web Components are a registry, not an alternative.** Web Components make a component work in any framework; Dedal decides which components make up the page and with what data. Here they meet in the registry: component name → tag. A Dedal slot maps directly onto a native named `<slot>`.

**Framework independence in practice.** The core (`build`, `resolve`) has no idea what renders the result. The same `ResolvedPage` could be rendered by `dedal/react`, by this renderer, or by a mobile app.

## Notes

- `defaults` from `createDedal` are added by `node()` — a JSON template doesn't go through `node()`, so it carries its props itself (here: `size`, `tone`, `variant`).
- Props become element **properties**, so the contract avoids names that `HTMLElement` already has (`title`, `hidden`…): `heading` instead of `title`.
- The page is rendered in the browser after `fetch`. Server-side HTML is possible (Declarative Shadow DOM), but out of scope here.
