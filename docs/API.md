# API reference

The complete reference of the package: formats, rules and every option. Every exported function and type, generated from the source: the [type reference](https://dawidglosny.github.io/dedal/types/). For an introduction, start with the [README](../README.md); for a guided tour with live examples, the [documentation site](https://dawidglosny.github.io/dedal/).

## Pipeline

```
ctx ─► layout ─► load (IO) ─► assign ─► resolve ─► render
         │                       │          │
     LayoutNode               DataMap  ResolvedNode     ← JSON formats, boundaries where a network can be placed
```

The same package handles a fullstack project (everything in one process) and a backend → middleware → front end setup (cutting the pipeline at any point).

## Design rules

1. **Formats between stages are plain JSON** — no functions, classes, `Symbol`, `Map`, `Date`, or `undefined` as a meaningful value. Round-trip tests `JSON.parse(JSON.stringify(x))` enforce this.
2. **Versioned envelope on the wire** — `{ dedal: 1, ... }`; an unknown component goes to the renderer's `fallback` instead of breaking the page.
3. **`page()` separates `block` (pure) from `data` (IO)** — the layout can be built without data (cache, separate endpoint), loaders run only where data is accessible.
4. **`toProps` is a pure module next to the contract, without IO** — `resolve` can run on either side of the network.
5. **`ctx` is serializable** — middleware can pass it on or use it in a cache key.
6. **`build()` is only a composition of the exported stages** — `load`, `layout`, `assign`, `resolve` are available separately.
7. **The core knows neither the transport nor the framework** — zero dependencies, ESM, runs in Node, on the edge and in the browser. Framework bindings live in separate entry points (`dedal/react`; `dedal/astro` planned).
8. **Functions are pure** — nothing mutates the input, unchanged subtrees are shared.
9. **Props on the node, before slots and children** — `node(component, { props, slots, children })`.

## Component contract

A single source of truth: component name → props and slots. Two ways to write it.

**As a value** — a props schema per component (any [Standard Schema](https://standardschema.dev) library: zod, valibot, arktype) and its slots. The type is inferred from it, and templates from outside the code can be checked against it at runtime:

```ts
import { createDedal, defineContract, type InferContract } from 'dedal'
import { z } from 'zod'

export const contract = defineContract({
  grid: { props: z.object({ columns: z.literal([1, 2, 3, 4]).optional() }) },
  card: { props: z.object({ title: z.string(), size: z.enum(['sm', 'md', 'lg']).optional() }), slots: { badge: 'one' } },
  tabs: { props: z.object({ labels: z.array(z.string()) }), slots: { content: 'many' } },
  divider: {},
})
export type Contract = InferContract<typeof contract>   // { card: { title: string; size?: …; badge?: Slot }, … }

const ui = createDedal({ contract })                      // typed by the contract, no type argument
```

- slots: `'one'` (a node) or `'many'` (a list of nodes); a component without `props` has none,
- the props type is the schema's output type; the core has no dependency — the Standard Schema interface is built in.

**As a type** — when no template needs checking at runtime. Slots are marked with `Slot` / `Slot[]`:

```ts
import type { Slot } from 'dedal'

type Contract = {
  grid: { columns?: 1 | 2 | 3 | 4 }
  card: { title?: string; href?: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }
  tabs: { labels?: string[]; content?: Slot[] }
}

const ui = createDedal<Contract>()
```

Either way the contract is shared by the server and every front end; a front end's registry (`name → component`) satisfies it via `satisfies Registry<Contract>`.

## Templates as JSON

A block is a plain object — `{ component, props?, slots?, children?, alias?, repeat? }` — so it doesn't have to be written in code. A template can be stored in a database, versioned, or generated from Figma, and passed to a section as it is.

```ts
const home = ui.page({
  // sections may be async: the template is read on every build, inside the page definition
  sections: async () => {
    const result = await ui.validateSections(JSON.parse(await storage.read('home')))   // { news: block, … }
    if (!result.ok) throw new Error(result.errors.map(e => `${e.path}: ${e.message}`).join('\n'))
    return Object.entries(result.value).map(([key, block]) => ui.section(key, block))
  },
  data: async () => ({ news: { card: await api.latest() } }),
})
```

- **`ui.validate(block, path?)`**, **`ui.validateSections({ key: block })`** (with `createDedal({ contract })`) → `{ ok: true, value }` typed by the contract, or `{ ok: false, errors: [{ path, message }] }` — every problem, in tree order: unknown components and slots (with a suggestion), the slot kind (`'one'` / `'many'`), props against their schema, `repeat`, `alias`, unknown fields. Props **missing** from a template are fine — data fills them at `resolve`; props that are there must match. `validateTemplate(contract, block, path)` is the same as a plain function.
- **`ui.jsonSchema(options?)`** / `contractToJsonSchema(contract, options?)` → `{ template, props, unconverted }`: `template` — a JSON Schema (draft 2020-12) of a template block, props partial, for validating templates outside JavaScript; `props` — the full props schema of every component, e.g. for a page builder's property panel. Props schemas come from Standard JSON Schema (zod 4) or `propsToJsonSchema(schema, component)` (e.g. `@valibot/to-json-schema`); components that couldn't be converted are listed in `unconverted`.
- **`defaults`** are merged under every node's props when the page is built (`layout()`), so a block from code and one parsed from JSON behave the same; `node()` returns exactly the block that was passed.
- **Debug builds** with a contract check every section block, deferred placeholder and `onEmpty` block against it: `report.trace.templateErrors`, shown by devtools with the paths — reported, not thrown.
- In code, `node()` types the block; for an inline literal use `satisfies BlockDefinition<Contract>`.

## API

```ts
const ui = createDedal<Contract>({ defaults: { card: { size: 'md' } } })
const { node, repeat, clone } = ui

const root = ui.layout(
  node('grid', {
    props: { columns: 3 },
    children: [
      node('hero', { slots: { media: node('card') } }),
      repeat(node('card'), 6),
    ],
  }),
  'news'
)

ui.patch(root, { 'grid > card:nth-child(odd)': { size: 'lg' }, 'hero > :slot(media)': { size: 'sm' } })
ui.remove(root, 'card:nth-child(n+5)')
ui.select(root, '#featured card')

const { layout, data, report } = ui.assign(root, {
  '#hero': [hero],                                      // specific selectors before general ones
  card: articles,                                       // data in order to the matching nodes
  'profile': { items: profiles, onShortage: 'keep' } // policy for a single selector
})
```

### Page (`page`, `section`)

```ts
const categoryPage = ui.page<{ device: 'desktop' | 'mobile'; page: number }>({
  sections: ({ device }) => [
    section('breadcrumbs', breadcrumbsBlock),
    section('pageHeader', titleBlock, { patch: { 'page-title': { headerTag: 'h1' } } }),
    device === 'desktop'
      ? section('mainContent', cardGrid9, { patch: { card: { loading: 'eager' } } })
      : section('mainContent', cardListMobile, { remove: 'divider', patch: { card: { size: 'small' } } }),
    section('about', aboutBlock),
  ],
  data: async ctx => {
    const { articles, category } = await fetchCategory(ctx)
    return {
      pageHeader: { 'page-title': [{ title: category.name }] },
      mainContent: { card: articles },
    }
  },
})

const result = await categoryPage.build({ device: 'mobile', page: 1 })
// { dedal: 1, sections: [{ key, layout }], data: { 'mainContent.0.0': ... }, report }
```

- Section key = prefix of its node IDs (`mainContent.0.2`) and the key of its data — section IDs don't depend on the sections above.
- Section: `layout` → `remove` → `patch` → `assign` (section `policies` over instance policies).
- `sections` is an array or a function of `ctx`, synchronous or async (templates from storage).
- Stages separately: `await page.layout(ctx)` (no data, cacheable), `page.load(ctx)`, `await page.assign(sections, data, ctx)`; `build` composes them.
- `report`: the `assign` report per section, `unknownData` (data without a section), `removedSections`, `failedSections`, `emptySections`.
- Empty section: a section that received bindings (from the section loader or the page's `data`), but after assignment no node has data — `onEmpty: 'remove'` (default, it disappears) | `'keep'` | `'error'` | a block (empty state, e.g. "No results"). `required: 'card'` — empty when no node matching the selector received data (e.g. the heading always gets it). Not subject to this: static sections (no data) and sections for which the loader or the page's `data` returned `undefined` — they stay with just the layout (devtools warn).
- Section keys must be unique within the page, and node IDs across the whole page (data is a single `ID → data` map); a duplicate = exception.

### Queries and section loaders (`ui.query`, `section({ data })`)

```ts
// query: a cached data source, shared by pages and sections
const menuQuery = ui.query({
  key: ({ service }: { service: string }) => ['menu', service],
  fn: ({ service }) => api.menu(service),
  staleTime: 10 * 60_000,
})

// shared section with its own loader — added to pages without adding data in each one
export const header = section('header', headerBlock, {
  data: async (ctx: Ctx) => ({ 'menu-item': (await menuQuery({ service: ctx.service })).items }),
})

// deferred section: a placeholder in the page result, content from page.section() in a separate request (Suspense, server islands)
const forYou = section('forYou', recommendedBlock, {
  defer: { fallback: skeletonBlock },
  optional: true,                       // a loader error removes the section (report.failedSections) instead of breaking the page
  data: async ctx => ({ card: await api.forUser(ctx.userId) }),
})

const home = ui.page<Ctx>({ sections: [header, main, forYou], data: async ctx => ({ main: { card: await api.news() } }) })
await home.section('forYou', ctx)       // the section alone → resolve → <Render>
```

- `page.load` runs the page's `data` and the section loaders in parallel — only for sections present in the variant and not removed; data for a section with its own loader returned by the page's `data` = error.
- `ui.query` is optional — the page's `data` and section loaders are plain `async` functions; you can call any source in them (`fetch`, an API client, a cache the application already has). `ui.query` adds an instance-level server cache: deduplication of parallel calls, stale-while-revalidate (`staleTime` 5 s by default, `maxAge` 5 min), `ui.invalidate(prefix)` shared with the page cache, and a swappable store (e.g. Redis).
- A query result is shared between requests and users: for user-dependent data, put the user in the key or don't use `ui.query`.
- The cache lives as long as the instance: create it once (at module level), not in every request.
- Query results and pages from the cache are frozen (read-only): `[...items].sort()` instead of `items.sort()`.
- `<Render deferred={({ sectionKey, fallback }) => <Suspense fallback={fallback}>…</Suspense>}>` — streaming deferred sections in Next.
- `defer.fallback` is a block (structure from the contract, part of the page result and its cache), rendered by the registry — e.g. a skeleton component. Not the same as `<Render fallback>` (a component for names missing from the registry).
- `page.section(key, ctx)` after the page has gone out: a loader error with `optional` → a result with no sections (`report.failedSections`) — remove the placeholder; without `optional` → it throws (in Next: the nearest error boundary); an empty section with `onEmpty: 'remove'` → no sections (`report.removedSections`).
- Without `<Suspense>` (an SPA, Web Components, a mobile app): an endpoint with `page.section()` + `resolve`; the client renders the page, fetches every section with `deferred: true` and swaps it in. Example: `examples/web-components`.

### Debug (`trace`, `dedal/devtools`)

```ts
import { inspect } from 'dedal/devtools'

const result = await home.build(ctx, { trace: true })   // bypasses the page cache
const resolved = ui.resolve(result, { ctx, trace: true })
const payload = inspect(result, resolved)               // JSON: sections, nodes, selectors, prop origin
```

- `trace`: the origin of every prop (`default`, `template`, `patch` with selector and section, `data`) and `report.trace` (section data source, cache key).
- `report.trace.timing`: `layout` / `load` / `assign` times, loaders (`page data` and section) and `ui.query` calls with cache status (`hit` / `stale` / `miss` / `bypass` / `error`), attributed to a loader. Attributing queries requires `AsyncLocalStorage` — global in Next.js and edge environments; elsewhere `createDedal({ AsyncLocalStorage })` from `node:async_hooks`.
- `inspect()`: a node index with a suggested selector (the shortest one matching only that node), the data and the selector that assigned it, and issues. Mismatch diagnosis: bindings without matches (with a hint for the corrected selector — including slot names, e.g. `:slot(badges)` → `:slot(badge)`), bindings "taken" by an earlier selector, `patch` / `remove` selectors with no effect, data without a place, removed nodes and dropped data.
- Functions for tests and logs: `reportText(payload)` (text report), `pageMessages(payload)` (`{ level, subject, text }` messages), `searchNodes(payload, query)` (search by selector, ID, section and data).
- Browser panel: `<Render debug>` (node markers in the DOM), `<DevtoolsData payload={payload} />` (payload on the page; payloads of streamed sections are merged), `<Devtools />` from `dedal/react/devtools` — a toggle button with the Dedal logo in the bottom-right corner opens it. The panel (Shadow DOM) has the tabs *node* (pick an element: ID, selector, data, prop origin), *tree* (search: selector, ID, section, text in data), *sections* (messages and bindings), *timing* (timeline of loaders and queries) and `copy report`; `Alt+Shift+S` opens / closes, `⇤` / `⇥` moves it to the other side, the state is remembered in the tab. Outside React: `mountDevtools()` from `dedal/devtools/panel`.
- Debug mode is enabled by the application — the payload reveals the page's structure and data. Example: `examples/next`, `?debug=1`.

Guide (enabling, safely enabling in production, other environments, the panel, common problems): the [*Devtools* page](https://dawidglosny.github.io/dedal/docs/devtools/) of the documentation.

### Renderable tree (`resolve`)

```ts
// contract/to-props.ts — a pure module next to the contract, imported wherever resolve runs
export const toProps: ToProps<Contract> = {
  card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
    data ? { ...props, title: data.headline, href: data.url } : props,
}

const ui = createDedal<Contract>({ toProps })
const resolved = ui.resolve(await page.build(ctx), { ctx, trace: isDev })
// { dedal: 1, sections: [{ key, tree: ResolvedNode }], issues: [] }
```

```ts
type ResolvedNode = { key; component; props; slots?; children?; trace? }
```

- Node props: `toProps[component]({ props, data, node, ctx })`; without a mapping — a deep merge of layout props with data (data wins). The mapping is also called for nodes without data.
- The mapping result is checked against the contract; the `data` type can be narrowed in the implementation (`ToPropsInput<C, 'card', Article>`).
- Issues don't break rendering: non-object data without a mapping, an exception in a mapping, data without a node (e.g. a mismatch between the cached layout and the data) go to `issues`, and the node gets the props from the layout. `onIssue: 'throw'` turns this into an exception.
- `trace: true` — on every node `trace: { prop: PropSource }`, where `PropSource` is `{ from: 'default' | 'template' | 'patch' | 'layout' | 'data' }` (`patch` with `selector` and `section`; `layout` when the layout was built without `trace`).
- The input is checked for the envelope version; `resolve` runs on either side of the network (input after `JSON.parse` gives the same result).

### React renderer (`dedal/react`)

```tsx
import { Render, type Registry } from 'dedal/react'

export const registry = {
  card: ({ title, href }) => <a href={href}>{title}</a>,
  hero: ({ title, media }) => <header>{media}<h1>{title}</h1></header>,   // slot as a prop (ReactNode)
  tabs: ({ labels, content }) => ...,                                      // list slot as ReactNode[]
  // ...
} satisfies Registry<Contract>   // a missing component or wrong props = compile error

<Render tree={resolved} registry={registry} fallback={Missing} />
```

- No hooks and no state — works in React Server Components, with SSR and on the client; registry components can be client components.
- Slots go to props named after the slot, layout children to `children` (the contract's `children` prop stays when the node has no children).
- Unknown component → `fallback` (nothing by default — without it the node renders nothing, with its children and slots). `fallback` receives `{ component, nodeKey }`: visible in development, `null` plus logging in production. Release order: the component in the registry first, then in templates.
- React is an optional `peerDependency`; the `dedal` core doesn't import it.

Example: [`examples/next`](../examples/next) — the same page on Radix Themes and shadcn/ui (one contract, two registries), switching `ctx`, debug mode, a JSON endpoint. Documentation by example (a tutorial, every feature, warning and error as a live page): the [documentation site](https://dawidglosny.github.io/dedal/), sources in [`site`](../site).

Example: [`examples/web-components`](../examples/web-components) — the same kind of page rendered without React: a small DOM renderer and a registry of Web Components (custom elements with native `<slot>`s).

### From Figma (`dedal/figma`, `dedal-figma`)

```ts
import { component, frame, mapping, swap, text, variant, boolean, layer } from 'dedal/figma'

const fromFigma = mapping(contract, {
  feature: component('FeatureCard', { icon: swap('Icon', name => name.replace('icon/', '')) }),
  split: component('Split', {}, { slots: { media: 'Media' }, children: 'Content' }),
  hero: frame('hero-copy', { title: layer('title') }),          // a plain frame — only explicitly
}, { section: 'section', text: 'text', ignore: [/-mock$/], componentName: name => name.replace(/ \(Radix\)$/, '') })

const { ok, sections, errors, unmapped, warnings } = await fromFigma.convert(response, '31:398') // GET /v1/files/:key/nodes?ids=…
```

- **Convention first:** an instance of a Figma component named like a contract component is that block; component properties named like its props fill them (`Label#3:0` → `label`; names compared without case, spaces, dashes, underscores); a native slot named like a contract slot fills it (`'one'` / `'many'` from the contract), other slots become `children`.
- **Explicit sources** (modelled on Figma's Code Connect): `text(property)`, `variant(property, values?)`, `boolean(property, values?)`, `swap(property, toValue?)` (for a variant of a component set, `toValue` also gets the variant's own name), `layer(name)` — a text layer inside the node, `image()` — the node's image fill (`figma-image:<ref>`; `imageRefs` / `replaceImageRefs` to resolve them yourself). A prop mapped explicitly is never filled by the convention.
- **Options:** `section` — a container for a section frame with several blocks; `text` — a component for loose text layers (`{ text, style }`, `style` = the Figma text style name); `ignore` — layers skipped whole (names or patterns); `componentName` — a rule for Figma component names, applied to `component()` names too.
- **Fails early:** a prop or slot the contract doesn't have (a compile error for props), two entries for one Figma component, two contract names that are the same for Figma.
- **The result:** every top-level layer is a section. `errors` — validation against the contract, with the template `path` and the `figma` layer path; `unmapped` — every layer that didn't make it into the template, with its path and why; `warnings` — an empty mapped container, several slots merged into children. Hidden layers are skipped; the content of an instance outside its native slots belongs to the component (a mapped instance there is reported).
- **CLI:** `dedal-figma pull <file key | URL> [node] --mapping <module> [--out file.json] [--images dir] [--image-url prefix] [--raw response.json] [--force]` — the token from `FIGMA_TOKEN`; `--images` downloads the images and puts local paths in the templates; a template that doesn't match the contract isn't written (exit code 1) unless `--force`; the mapping module's default export is the mapping.

Guide: *Templates from Figma* on the documentation site. Example: [`examples/figma`](../examples/figma) — a landing page pulled from a Figma frame and rendered by Dedal. Decision record: [ADR-003](adr/003-figma-mapping.md).

### Page cache (`page({ cache })`)

```ts
const ui = createDedal<Contract>({ toProps, cache: { staleTime: 5_000 } })   // optional: store and timings

const home = ui.page<Ctx>({ sections, data, cache: { key: ctx => ['home', ctx.device] } })
await home.build(ctx)          // from the cache
await ui.invalidate(['home'])  // e.g. after publishing
```

- The instance holds the shared store and timings, the page provides the key — `key` (an array; everything the sections and data depend on; `undefined` = no cache), `staleTime` (5 s by default), `maxAge` (5 min by default), `invalidate(prefix)`.
- Stale-while-revalidate: the entry is returned immediately, refreshed in the background (`waitUntil` on the edge); older than `maxAge` — the request waits for `build`.
- Parallel requests for the same key wait for a single `build`; errors are not cached.
- Store: `memoryStore({ max })` by default (LRU, frozen copies of entries); Redis / Mongo / KV via the `Store` interface.
- A page without `cache` is not cached. Personalized data: the key must include the user or the page has no `cache`.

More (deployments, store, query, debug): the [*Cache & queries* page](https://dawidglosny.github.io/dedal/docs/cache/) of the documentation.

### Data assignment (`assign`)

- Data items go in order to the nodes matching the selector, in tree order.
- Selectors are processed in entry order; a node taken by an earlier selector (even without data) is skipped by later ones.
- `null` / `undefined` in the data = no data for the node.
- `onShortage` — a node without data: `'remove'` (default) | `'keep'` | `'error'`.
- `onSurplus` — data without a node: `'ignore'` (default) | `'error'`.
- Policies (weakest first): package defaults → `createDedal({ assign })` → section `policies` or the `assign(..., policies)` call → `{ items, onShortage }` for a selector.
- Removing a node removes its subtree; the descendants' data goes to `report.dropped`.
- The result (`layout`, `data`, `report`) is plain JSON; `data` is a flat `ID → data` map.

### ID

Positional, opaque — used only for keying (data, `key` in the renderer). By default:

| node | ID |
|---|---|
| root | `news` |
| child | `news.0`, `news.0.2` |
| single slot | `news.0:media` |
| list slot | `news.1:content.0` |

The generator can be replaced with the `id` option (`createDedal({ id })`). A custom generator must produce IDs unique across the whole page — the simplest way is with a prefix (the section key), like the default one; a duplicate within a section or between sections throws an exception.

### Selectors (CSS syntax)

| Selector | Meaning |
|---|---|
| `card`, `*` | component / any |
| `#hero` | alias |
| `[size]`, `[size=small]`, `[style.height="100%"]` | prop exists / has a value |
| `:first-child`, `:last-child`, `:nth-child(an+b \| odd \| even)`, `:nth-last-child(...)` | position among siblings (from 1); in a list slot — within the slot |
| `:slot`, `:slot(media)` | node in any / a specific slot of the parent |
| `:root` | root of the tree (section) |
| `a b`, `a > b`, `a, b` | descendant (also through slots), child or slot content, list |

Tree order: slots first (in key order), then children. With several patches on the same node, the later entry wins; selectors are matched against the input tree (like CSS against the DOM).
