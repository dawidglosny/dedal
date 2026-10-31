# Changelog

## Unreleased

Added:
- `dedal/figma`: `image()` — a node's image fill as `figma-image:<imageRef>`; `imageRefs()` and `replaceImageRefs()` to resolve them.
- `dedal-figma pull --images <dir> [--image-url <prefix>]` — downloads the images (Figma's image URLs expire) and puts local paths in the templates.

## 0.8.0

**Figma in the package** — `dedal/figma` turns a Figma frame into templates, checked against the contract ([ADR-003](docs/adr/003-figma-mapping.md)).

Added:
- `mapping(contract, entries, options)` — a mapping per contract component, modelled on Figma's Code Connect: convention first (component, property and slot names), explicit sources where names differ — `component`, `frame`, `text`, `variant`, `boolean`, `swap`, `layer`; `convert(response, nodeId)` reads a `GET /v1/files/:key/nodes` response.
- Native Figma slots → contract slots (`'one'` / `'many'`) or children; `component(…, { slots, children })` to map them explicitly.
- Options: `section` (a container for a section with several blocks), `text` (loose text layers as text blocks, with their Figma text style), `ignore` (decorative layers skipped whole), `componentName` (a rule for library suffixes).
- The result: `errors` with the template path and the Figma layer, `unmapped` — every layer left out, with its path and why — and `warnings` (an empty container, merged slots). Ambiguous mappings and unknown props or slots fail when the mapping is created; unknown props are compile errors.
- `dedal-figma pull <file | URL> [node] --mapping <module> [--out] [--raw] [--force]` — fetches the frame with `FIGMA_TOKEN`, converts it, writes the templates; a template that doesn't match the contract isn't written.

Documentation:
- *Templates from Figma* rewritten on `dedal/figma` and the CLI; the converter that relied on invented naming conventions (`slot:` layers, props in frame names) is gone,
- ADR-003: from Figma to templates — a mapping per component (accepted).

Fixed:
- The devtools panel drops payloads removed from the page — with `<Devtools />` in a layout that survives client-side navigation, a page without a payload no longer shows the previous page's data.

Documentation site:
- moved to Fumadocs: MDX pages, sidebar, table of contents, search, dark mode; the live examples keep Radix Themes, scoped to their preview; the same URLs,
- a link checker for the exported site (`npm run check-links` in `site/`).

## 0.7.0

**The contract at runtime** — templates from storage, Figma or a page builder are now a first-class path ([ADR-002](docs/adr/002-runtime-contract.md)).

Added:
- `defineContract({ card: { props: schema, slots: { badge: 'one' } } })` — the contract as a value, with any Standard Schema library (zod, valibot, arktype); `InferContract<typeof contract>` gives the same type as a hand-written contract. The core still has no dependencies.
- `createDedal({ contract })` — the instance typed by the contract, no type argument.
- `ui.validate(block)`, `ui.validateSections({ key: block })`, `validateTemplate(contract, block)` — every problem with its path (`news.children[2].slots.badge`): unknown components and slots (with a suggestion), the slot kind, props against their schema, `repeat`, `alias`, unknown fields. Props missing from a template are fine — data fills them.
- `ui.jsonSchema()`, `contractToJsonSchema(contract)` — a JSON Schema of a template block and the props schema of every component (Standard JSON Schema, or `propsToJsonSchema` for other libraries).
- Async `sections: async (ctx) => [...]` — templates loaded inside the page definition.
- Devtools: with a contract, debug builds check every section block, deferred placeholder and `onEmpty` block against it — errors with paths in the panel and the report (`report.trace.templateErrors`); the page still renders.

Breaking:
- **`node()` no longer adds `defaults` to the block it returns** — they are merged in by `layout()` when the page is built, for blocks from code and from JSON alike. Code that read defaults from a block returned by `node()` reads them from the layout instead.
- **`page.layout(ctx)` and `page.assign(sections, data, ctx)` return Promises** — add `await`.
- `trace` reports a prop as `default` only when the block doesn't set it (it used to compare values).

Migration: a contract written as a type keeps working unchanged (`createDedal<Contract>()`); switch to `defineContract` where templates come from outside the code.

Documentation:
- positioning: the engine behind pages generated from Figma or a page builder, rendered with your own design system; mobile apps moved to *Later*,
- decision records in `docs/adr/`: 000 positioning, 001 scope, 002 the contract at runtime,
- the docs site's contracts are values; *Tutorial* step 4, *Templates in a database or CMS* and *Templates from Figma* use validation and async sections; a new case — *A template that doesn't match the contract*,
- `examples/web-components` on the new API; `docs/ROADMAP.md` no longer points to design notes missing from the public history.

## 0.6.6

No changes to the API or behavior. The package gains JSDoc descriptions for the 26 exported types that had none.

Documentation:
- the headline: "Change screens without changing code", with "structure, data and components — kept apart, joined at the last moment" right below (README, the docs site),
- a *Guides* part: *Templates in a database or CMS* (the stored shape, validation, caching through `ui.query`, the version in the cache key, drafts and preview, publishing, CI), *Templates from Figma* (a naming convention and a converter over the Figma REST API), *Adopting in an existing app* (one block first, the registry as an adapter over existing components), *A client without React* (the page format, a renderer in a few dozen lines, older mobile apps via the app version in `ctx`) and *Testing* (build reports, `onIssue: 'throw'`, devtools messages, snapshots); the code in every guide was run as written,
- a *Reference* part: the API reference on the site (from `docs/API.md` — one source), a type reference generated from the JSDoc (TypeDoc, `npm run docs:types`) at `/types/`, *Glossary* and *Limitations* as pages of their own,
- the menu in parts — *Get started*, *Learn*, *Guides*, *Features*, *Troubleshooting*, *Reference*; a group's cases shown only for the group being read, and a legend for the colored dots,
- clarity: *Introduction* shows the example before the data-flow diagram and defines a section in plain words; *Data*, *Sections* and *Cache* start the dense parts with a plain sentence; *Tutorial* step 2 shows only the three components it starts with; *Another domain: a dashboard* comes right after the tutorial; the docs pages render tables, `###` headings and links,
- README: *Size and speed* (bundle sizes, benchmark timings, the number of tests), links to *Limitations* and the type reference,
- `CONTRIBUTING.md`: setup, where things are, the docs site and the examples, what a pull request needs.

## 0.6.5

Devtools:
- fix: closing the panel (the button or `Alt+Shift+S`) clears the highlight boxes on the page and ends picking — they used to stay until the next hover.

Documentation:
- a *Quick start* page: install, a contract, a page, a registry, render in Next.js or plain Node — the code runs as written; linked from the home page, the header and the README,
- the docs site's home page explains Dedal at a glance: the benefit in the first lines, the three parts (structure, data, components) and who changes each, a before/after example, and how Dedal compares with React Server Components, Web Components, CMSs and hand-made JSON,
- deferred sections and fallbacks: *Sections* explains the two different fallbacks (`defer.fallback` — a block; `<Render fallback>` — a component for missing names), what replaces the placeholder when a deferred section fails or is empty, and deferred sections without `<Suspense>` (an endpoint); new cases *Deferred: the placeholder*, *Deferred: when the section fails or is empty*, *Deferred without Suspense*; *Rendering* covers `<Render fallback>` (props, development vs production, release order).

Examples:
- `examples/web-components`: a deferred section "For you" with a skeleton placeholder, served by its own endpoint and swapped in by the browser,
- `examples/custom-ds` removed — `examples/next` and `examples/web-components` cover the same features, and the docs site covers the rest.

## 0.6.4

Devtools:
- the panel's toggle button is the Dedal logo in the logo's colors, on a navy background (no text label; `aria-label` for screen readers),
- the panel follows the logo's palette: navy blueprint paper with a faint grid, blue accents and page highlights, orange for multiple matches; green (data) and red (errors) keep their meaning.

Documentation (no changes to the API or behavior):
- README, landing page and *Why Dedal* start from the general idea — structure, data and components kept apart and joined at the last moment — instead of one use case,
- *Who it is for* defined by a property of the UI (structure changing on a different schedule, by different people, or from a different system than the components), with examples across domains: mobile apps, content sites, dashboards, onboarding, stores, many products on one design system,
- where Dedal came from moved to the end of *Why Dedal*,
- a new docs group, *Another domain: a dashboard* — the same engine on a different contract: widgets per role, a layout saved per customer as JSON, a failing data source; the tutorial notes that its content-site example is just one domain,
- docs site: no empty space under the rendered examples (Radix Themes gave the result frame the height of the screen),
- the devtools button described where the docs mention opening the panel (*Devtools*: a new section, *Opening the panel*),
- the logo: in the README, the docs site header and favicon; the site's colors follow it (blueprint blue, an orange core) in both light and dark themes,
- `examples/web-components`: the design system's colors follow the logo too (a navy-to-blue hero, an orange primary button, blue badges).

## 0.6.3

Documentation only, no changes to the API or behavior:
- the tutorial rebuilt around the core idea: 7 steps plus a debugging exercise — the finished page and its JSON first, contract and registry together, and a new step *The template as data* (a stored, validated JSON template changed without touching the code); shared sections, streaming and cache moved to a new group, *Going to production*,
- `examples/web-components`: templates read on every request, with the template version in the page cache key — edit `templates/home.json` and reload; an invalid template returns an error instead of crashing the server,
- every docs group page starts with a plain-language summary ("In short"),
- docs hints that assumed a running server (reloading to see streaming) updated for the static site.

## 0.6.2

Documentation only, no changes to the API or behavior:
- README rewritten as an introduction: what Dedal is for, when it fits and when it doesn't, how it compares with React Server Components, Web Components and CMSs; the API reference moved to [docs/API.md](docs/API.md) (with a new section on templates stored as JSON), the changelog to this file,
- the documentation by example moved from `examples/next` to a static site in `site/`, published on GitHub Pages (https://dawidglosny.github.io/dedal/): a landing page, sidebar, table of contents, search, highlighted code, dark mode; the devtools panel works on every case page,
- a new first docs page, *Why Dedal*; *Introduction* starts with five basic terms,
- positioning: Dedal is about changing page layouts without a frontend release; who it is for by kind of product (media, many sites on one design system, e-commerce, mobile apps); framework independence is a bonus, and Dedal is not a way to distribute a component library,
- new example [`examples/web-components`](examples/web-components): a JSON template validated at startup, a plain Node server, a ~20-line DOM renderer and custom elements with native slots,
- [docs/ROADMAP.md](docs/ROADMAP.md): templates stored as JSON (`defaults` and runtime validation).

## 0.6.1

README, `/docs`, examples and tests in English; English identifiers, URLs and data in the examples. No changes to the API or behavior.

## 0.6.0

New name: **Dedal** (formerly ssduie). Breaking changes: package and imports `dedal`, `dedal/react`, `dedal/devtools`…; `createDedal`, `DedalOptions`, `Dedal`; wire envelope `{ dedal: 1, … }` (instead of `ssduie`); devtools markers `<dedal-node data-dedal-key>`, `data-dedal-devtools`, `#dedal-devtools`. API and behavior unchanged.

## 0.5.3

`<Devtools />` without the `open` prop restores the panel state remembered in the browser tab (previously it always started closed); the devtools guide moved to `/docs` (the *Devtools* page: enabling in Next, safe enabling, common problems, costs); the developer contracts in `docs/` replaced by [docs/ROADMAP.md](docs/ROADMAP.md).

## 0.5.2

Devtools suggest the correct slot name for a binding without matches (`card > :slot(badges)` → `card > :slot(badge)`); the `examples/next` documentation (`/docs`) checked against the code and expanded for people new to server-driven UI.

## 0.5.1

Node IDs unique across sections (exception on a duplicate from a custom generator); node issues (`resolve` issues) in devtools messages and report; clearer `required` / `remove` messages.

## 0.5.0

Devtools: *timing* tab, `copy report`, tree search (selector, ID, section, data), remembered panel state, `Alt+Shift+S`, switching the panel side.
