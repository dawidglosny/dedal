# Changelog

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
