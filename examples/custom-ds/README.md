# Dedal × a custom design system

The home page of a song lyrics site built with Dedal and the components of a custom design system: layout primitives (`wrapper-container`, `wrapper-layout`, `wrapper-group`), tiles, cards, a carousel, ads. An engine-level example — without a renderer: it builds `PageResult` and `ResolvedPage` on mocked data sources.

```bash
npm run dedal   # build the package → npm pack → install from vendor/
npm test         # page tests
npm run demo     # sections, node count and result size for desktop and mobile
```

## Structure

| File | Role |
|---|---|
| `src/contract.ts` | component contract: open props, slots declared explicitly alongside (`carousel.items`, `special-content.secondaryComponent`) |
| `src/ui.ts` | instance options: default component props, `toProps.card` (card data in the `data` prop) |
| `src/blocks.ts` | blocks: plain constants and functions (`node`, `repeat`, `clone`), separate desktop / mobile variants where the structure differs |
| `src/helpers.ts` | per-component section data: song tiles (with "artist – title" parsing), category carousel, news |
| `src/home.page.ts` | page: queries, shared sections (header, breadcrumbs, footer), content sections, patches, bindings |
| `src/api.ts`, `src/mocks.ts` | data source interface and mocks |

## What the example shows

**Queries and shared sections.** Page meta, global data, categories and article lists are queries (`ui.query`). The header, breadcrumbs and footer are sections with their own loaders — they use the same queries as the page's `data`, so global data is fetched once per page (the "shared data fetched once" test). The page creates its own instance (`createHomePage(api)`): the query cache belongs to the data source.

**Device variants.** `sections: ({ device }) => [...]` — different blocks (a list in columns vs a single column), different patches, a mobile-only section (`middleSliderAd`).

**Per-component bindings.** Section data is separate lists for the heading, tiles and covers (`{ 'block-header': [...], 'tile-v2': [...], 'image-holder': [...] }`). When data is short, a tile and its cover stay as a pair, and surplus nodes disappear (`onShortage: 'remove'`).

**Slots instead of components in data.**
- CTA: the logo in the content block's `secondaryComponent` slot; on mobile the section removes the slot (`remove: 'special-content > :slot(secondaryComponent)'`).
- Category carousel: items in the `items` list slot — `repeat(special-content, 12)` trimmed to the number of categories; item images in their slots (`'special-content > :slot(secondaryComponent)'`).

**Selectors in patches.** `tile-v2` (all tiles in the section), `:root` (the section root), `:root > wrapper-layout` (a direct child of the root), `special-content`.

**Binding order.** In the CTA the specific selector (the logo in the slot) comes before the general one (`image-holder`) — the earlier selector takes the node and the later one skips it.

**Cards.** `toProps.card` passes the card data in the `data` prop, with tracking alongside (`setupTracking`); the other components get the data spread into props.

**Data-dependent sections.** Song lists have `required: 'tile-v2'`: the section is empty when no tile received data (the heading always gets it). An empty section disappears by default (`onEmpty: 'remove'`) — `featured` with an empty source (`report.removedSections`, `report.emptySections`).

## Patterns

| Need | Pattern |
|---|---|
| Related nodes (a divider disappears together with the tile next to it) | a separate binding for dividers: `{}` — stays, `null` — no data, removed (`relatedDividers` in `home.page.ts`) |

Query results are frozen (read-only) — the page makes copies when it changes something (`metaFor`) and doesn't sort lists in place.
