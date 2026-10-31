# Roadmap — open plans and development principles

Things not yet done, open questions and the principles we follow in further work. User documentation (how to use the package) is on the [documentation site](https://dawidglosny.github.io/dedal/) (sources in [`site`](../site)), the [README](../README.md) and the [API reference](API.md). The earlier design notes (cache, devtools, performance) have been implemented: their decisions live in the code, the tests, the docs and the principles below. Decisions from now on are recorded in [adr/](adr/).

## Principles for further development

They complement the "Design rules" in the [API reference](API.md).

**Cache**
- Caching is enabled by the page (`page({ cache: { key } })`), not by the package. No automatic cache with a key guessed from `ctx` — that risks leaking data between users.
- The key is explicit and must include everything `sections(ctx)` and `data(ctx)` depend on.
- The core doesn't know the store — only the `Store` interface; Redis, Mongo, KV are adapters on the application side or separate packages.
- The cache doesn't change the shape of the result; errors are not cached; shared entries are frozen; process memory has a limit (LRU).

**Devtools**
- Zero cost in production: the core and `dedal/react` don't import devtools; without debug mode the result and the DOM are identical.
- The payload is plain JSON (works in a backend → front end setup); the pure part (`dedal/devtools`) doesn't depend on the DOM or a framework.
- Devtools don't change the result and don't require cooperation from the registry (no `data-*` or refs in components).
- A build with `trace` bypasses the page cache; debug mode is enabled by the application; the panel is read-only.

**Performance**
- Optimizations don't change semantics (tree and assignment order, IDs, subtree sharing) or the wire formats.
- No global package state grows without bound with the number of requests.
- Every change is verified by a before / after measurement: `npm run bench` (scenario in `bench/bench.mjs`). Baseline from 0.5.x: a page of 530 nodes — build + resolve ~0.8 ms; 3620 nodes — ~6.5 ms.

## Open

### `assign`: empty containers (`prune`) and related nodes (`removeWith`)

Status: proposal, not implemented.

**Problem.** `onShortage: 'remove'` removes only nodes without data (with their subtree). What remains:
- **empty containers** — a parent that lost all its children (grid, group, column) leaves a gap, a background or a heading without content on the page,
- **related nodes** — a node that only makes sense next to another one (a divider before a tile, a label above a card) stays when its "partner" disappears.

Workarounds today: `null` in the data for the container / related node (requires counting in the loader how many nodes will remain) or splitting into separate sections (then `onEmpty` works).

**`prune`** — after nodes are removed by `onShortage`, removes ancestors up the tree that were left without children and without slots and match the selector; repeated as long as something gets removed.

```ts
ui.page({ sections, data, assign: { prune: 'grid, wrapper-group' } })   // for the page
{ card: { items: articles, prune: 'grid' } }                            // for a binding
```

- only nodes that **lost** children in this `assign` are removed (a container empty from the start stays),
- a node with data is not removed, even when it is empty,
- removing a section's root works like `onEmpty: 'remove'` (`report.removedSections`),
- `report.sections[key].pruned: string[]` — separate from `removed`, visible in devtools,
- without `prune` the behavior doesn't change.

**`removeWith`** — a binding specifies what disappears together with a node removed by `onShortage`:

```ts
{ tile: { items: songs, removeWith: { before: 'divider' } } }
```

- `before` / `after` — a sibling in the same parent (after expanding `repeat`) matching the selector,
- `parent` — the nearest ancestor matching the selector (e.g. `{ parent: 'wrapper-layout' }`),
- removed nodes go to `report.sections[key].removed`; in debug mode with information on which node caused it.

**Order in `assign`:** assignment and `onShortage` → `removeWith` → removal → `prune` → `onEmpty`.

**Questions:**
- Should `prune` have a default value, or always an explicit selector? Explicit is safer — it says which components are "just a wrapper".
- `prune` in the contract (a per-component "container" flag in the instance options) instead of on every page?
- Is a node with slots but no children (a card with an empty slot) empty? Proposal: no — slots are the component's content.

### Figma: a plugin

Status: planned. Today frames come through the REST API (`dedal-figma pull`, `dedal-mcp`), which needs a token. A Figma plugin would convert the selected frame where the designer works: either with the contract given as JSON Schema (`ui.jsonSchema()`) and the naming convention, showing the template and the report in the plugin — or exporting the frame in the REST shape for the CLI to convert. The Plugin API also sees what REST doesn't (variables as design tokens).

### A page builder example

Status: planned. The second source of templates after Figma, shown on a working editor: a palette of the contract's components, property panels generated from the contract's JSON Schema (`ui.jsonSchema()`), a live preview through `<Render>`, sections reordered by dragging, the template saved only when `ui.validateSections` accepts it.

*Templates stored as JSON* — the runtime contract, `defaults` applied in `layout()`, async `sections` — shipped in 0.7.0 ([ADR-002](adr/002-runtime-contract.md)).

### `dedal/astro`

Status: decisions before implementation. A renderer like `dedal/react`: `ResolvedPage` → components from the registry; HTML without JavaScript by default, only islands are interactive.

**Client islands (`client:*`).** Dynamic tags in Astro (a component in a variable) don't support hydration directives, so the renderer can't write `<C client:visible />`. Conclusion: hydration is declared by the registry — an interactive component is an `.astro` wrapper in the registry with a static directive:

```astro
---
// registry/TabsIsland.astro
import Tabs from '../components/Tabs'
---
<Tabs client:visible {...Astro.props}><slot name="content" slot="content" /></Tabs>
```

- Dedal's props are JSON, so they fit islands as they are,
- Dedal's slots → named Astro slots (slot content as static HTML; nested islands work),
- later: server-driven hydration (e.g. a node prop `hydrate: 'visible' | 'load'`) — a wrapper with branches, each with a static directive.

**Server islands (`server:defer`).** A section with `deferred: true` → a wrapper with `server:defer` that, in its own request, does `page.section(key, ctx)` + `resolve` + render; the fallback as `slot="fallback"`. Island props = `ctx` + the section key — Astro encrypts them in the URL (GET, cacheable); above 2048 bytes it switches to POST, which the browser doesn't cache, so `ctx` should be small. Requires an adapter (on-demand rendering).

**Questions:**
- Does the renderer itself wrap deferred sections in `server:defer`, or does the application do it?
- How does the registry declare islands in types (`Registry<Contract>` with `.astro` wrappers)?
- How to pass the page instance to the server island (import the page module by key?)?
- The devtools panel in Astro (the same payload and `mountDevtools()`; node markers without `<Render debug>`).

### Cache and query

- **External adapter example** (e.g. Redis) in the documentation or `examples`, including `deletePrefix` and `lock`.
- **Warning about a too-narrow key** in development mode (e.g. the same key but a different result for different `ctx`). Open: how to enable development mode — together with devtools.
- **Dependency tracking** — a page entry remembers the keys of queries used during the build; `ui.invalidate(['menu'])` also invalidates dependent pages. Requires entry metadata in `Store`.
- **Prefetch / warm-up** — e.g. `menuQuery.prefetch(params)` at server start.
- Out of scope: HTTP cache headers, caching `ResolvedPage`, in-process caching of the layout alone, ready-made adapters in this package.

### Devtools

- **Build diff** — comparing two payloads (e.g. before / after a block change or for two `ctx`).
- Possibly a browser extension on the same payload.
- Out of scope: editing the layout / data from the panel.

### Performance

- **Path in `layout()`** — copying the path array (`[...path, segment]`) for every node's `IdContext` is the single largest cost of the layout stage.
- **A single pass for all selectors in `assign`** (today: one per binding), preserving the rule that an earlier binding takes a node first. Today ~1.5 ms for 3620 nodes — we'll come back to it if measurements on real pages show it as a significant cost.
- Deliberately unchanged (we'll come back on a real problem): the extra pass in `resolve` (`collectKeys`), `JSON.stringify` in `trace`, the descendant selector without memoization (real blocks < 0.1 ms), JSON size for very large pages (compresses well).
