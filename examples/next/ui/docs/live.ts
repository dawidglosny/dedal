/**
 * "See it live" hints: what to open in the devtools panel on each case page and what to look for.
 * The same inline format as case descriptions (`code`, *tab*).
 */
export const live: Record<string, string> = {
  // tutorial
  'tutorial-contract':
    'Click `pick` and point at the "Welcome to Dedal" heading — *node* shows the `section` component, the ID `welcome` and the props `title`, `description` with the source `← template` (from the block).',
  'tutorial-first-block':
    '*tree* → section `news`: `section` → `grid` → three `card`s with the IDs `news.0.0`, `news.0.1`, `news.0.2`. `pick` on a card → props `title ← template`, `size ← default`.',
  'tutorial-data':
    '*sections* → `✓ card — 3 data items for 3 nodes`. `pick` on a card → *node* → **data** (the article from the API) and `assigned by card`.',
  'tutorial-to-props':
    '`pick` on a card → *node*: **data** has `headline`, `slug`, `cover` (the API shape), and **props** has `title ← data`, `href ← data`, `image ← data`, `size ← default`. That\'s the work of toProps and defaults.',
  'tutorial-slots':
    '*tree* → in every card, the nodes `badge :slot(badge)` and `avatar :slot(footer)`, marked with ● (they have data). *sections* → three bindings: `card`, `card > :slot(badge)`, `card > :slot(footer)`.',
  'tutorial-shared-section':
    '*sections* → `source: section` next to `hero`, `source: page` next to `news`. *timing* → `hero` and `page data` start together (in parallel).',
  'tutorial-variants':
    '*tree* → the `news` section has one column and two cards (that\'s the `mobile` variant). `pick` on the grid → `columns: 1 ← template`.',
  'tutorial-patch-remove':
    '`pick` on the first card in "Latest" → `size: "lg" ← patch card:first-child`. *tree* → the cards in the `more` section have no `footer` slot (removed by `remove`).',
  'tutorial-missing-data':
    '*sections* → `✗ recommendations failed — the loader threw "recommendations API: 503"` and `! promotions removed — no node got data`. *timing* → the `recommendations` loader in red.',
  'tutorial-defer':
    'Reload the page: "For you" is a fallback at first, and the content arrives after ~800 ms. *timing* → a separate block `section forYou (streamed separately)`.',
  'tutorial-queries-cache':
    '*timing* → under `hero` and `page data`, the query `["tutorial","articles",8]`. On the first visit (after the server starts) both are `miss`, but there\'s only one fetch — the second loader waits for the same one (deduplication). Reload the page: both are `hit`. *sections* → `cache key: ["page","tutorial-home","desktop"]`.',
  'tutorial-debugging':
    'This step is an exercise — the panel is your main tool. Start with *sections*: at the top you\'ll see a summary of the page\'s problems, and the details next to each section. Each task below hints where to look.',
  'tutorial-render':
    'The whole panel: `pick` on any element, *tree* with search (type an article title), *sections*, *timing* and `copy report` — these are the tools you use every day when working with Dedal pages.',

  // layout
  'blocks-repeat':
    '*tree* → section `news`: a grid and three cards with the IDs `news.0.0`, `news.0.1`, `news.0.2`. Click `pick` and point at a card on the page — *node* shows its ID, a suggested selector and props (`size: "md" ← default`).',
  slots:
    '*tree* → nodes in slots are labelled `:slot(media)`, `:slot(actions)`, `:slot(badge)`, and their IDs include the slot name (`hero:media`, `hero:actions.0`). `pick` on a badge on a card → *node* → data `assigned by card > :slot(badge)`.',
  aliases:
    '*tree* → `card #featured`. Type `#featured` into the *tree* search field — it matches exactly one card. `pick` on the featured card → *node* → data `assigned by #featured`.',
  'patch-selectors':
    '`pick` on the last card → *node* → `size: "sm" ← patch card:last-child`; on a badge → `variant ← patch …`. Type a selector from the patch into the *tree* field (e.g. `card:nth-child(even) > :slot(badge)`) to see which nodes it hits.',
  'patch-no-match':
    '*sections* → `! patch “crad” matches no node in this section`. Click the **card** suggestion — *tree* shows the nodes the corrected selector would hit.',
  remove: '*tree* → the cards have only the `badge` slot — `remove` removed the `footer` slot. Compare with the *Slots* case, where the cards have both slots.',
  'remove-root': '*sections* → `! promo removed — the section\'s remove option removed its root`. *tree* has only the `news` section.',
  variants:
    '*tree* → one column and two cards (the `mobile` variant). `pick` on the grid → *node* → `columns: 1 ← template`. On the example\'s home page, switch `ctx.device` to see both variants.',

  // data
  bindings:
    '*sections* → `✓ card — 3 data items for 3 nodes` and `✓ card > :slot(badge) — …`. Hover over a binding — the panel highlights the nodes on the page that received its data.',
  'to-props':
    '`pick` on a card → *node* → **data** (the raw article from the API: `headline`, `slug`…) and **props** after mapping: `title ← data`, `href ← data`, `size ← default`.',
  'null-items': '*sections* → `! card — 3 data items for 3 nodes (1 null)` and `1 node removed — nothing to fill it with`. Two cards are left in *tree*.',
  'shortage-remove': '*sections* → `! card — 2 data items for 4 nodes`, `2 nodes removed — …`. Only two cards in *tree*.',
  'shortage-keep': '*sections* → `2 nodes left empty (onShortage: \'keep\')`. In *tree* the last two cards have no ● marker (no data).',
  surplus:
    '*sections* → `3 data items not shown — no node left for them:` with a list of articles. Type part of the title of one of them into the *tree* field — the panel tells you it\'s only in data that didn\'t make it to the page.',
  'binding-no-match':
    '*sections* → `✗ crad — 3 data items for 0 nodes` and the suggestion **card**. *tree* → the section "removed — no data; layout before assign" — you can see the layout that was waiting for data.',
  'binding-order':
    '*sections* → `✗ #featured — 1 data item for 0 nodes` with instructions on how to fix it. `pick` on the featured card → *node* → `assigned by card` (instead of `#featured`).',
  dropped: '*sections* → `news.1.0, news.1.1 had data, but their parent news.1 was removed`. *tree* has no second grid (`#more`).',

  // sections
  'section-loader':
    '*sections* → `source: section` next to `header`, `source: page` next to `news`. *timing* → the `header` loader and `page data` on a shared timeline — they start together.',
  'optional-failed':
    '*sections* → `✗ recommendations failed — the loader threw "recommendations API: 503"`. *timing* → the `recommendations` loader bar in red. The `news` section is on the page as usual.',
  'on-empty-remove': '*sections* → `! promotions removed — no node got data (onEmpty: \'remove\')`. Only the `news` section in *tree*.',
  'on-empty-keep': '*sections* → `! promotions empty — … kept as is`. In *tree*, the `promotions` section with cards without ●.',
  'on-empty-block':
    '*sections* → `! search empty — … replaced by the onEmpty block`. `pick` on "No results" — it\'s a node of the replacement block, not of the original section.',
  required:
    '*sections* → `! popular removed — none of the required nodes got data` — even though the hero got data. *tree* → the section "removed — no data; layout before assign" with the hero and cards.',
  defer:
    'Reload the page: "For you" is a fallback at first, and the content arrives after ~800 ms. *timing* → a separate block `section forYou (streamed separately)`; *tree* → the `forYou` section once it arrives.',
  'unknown-data':
    '*sections* → `! newz unknownData — … Did you mean: news?`. The `news` section got nothing — in *tree*, cards without ●, `source: none`.',
  'loader-undefined': '*sections* → `! news no data — the section loader returned undefined for this section, so it shows its layout only`.',

  // cache & queries
  'page-cache': '*sections* → `· cache key: ["page","docs-page-cache","desktop"] — debug builds bypass the cache`. *timing* shows a full build — debug doesn\'t read from the page cache.',
  'cache-key-undefined': '*sections* → `· cache key: none — cache.key returned undefined for this ctx, so the page is not cached`.',
  'query-statuses':
    '*timing* → under `page data`, five queries in order: `miss`, `hit`, `miss`, `stale`, `bypass` — with timings (`hit` and `stale` take a fraction of a ms). Summary: `queries — 2 miss · 1 hit · 1 stale · 1 bypass`.',
  invalidate: '*timing* → the query `["articles","latest"]` has the status `miss` — after `invalidate` the cache was empty.',

  // rendering
  'registry-missing':
    '*sections* → `✗ badge is not in the registry — 3 nodes rendered by the fallback`. *tree* → `!` next to every badge; `pick` on a dashed frame → *node* → an issue about the registry.',
  'data-not-object':
    '*sections* → `✗ 1 node has issues` and the issue text next to the section. *tree* → `!` next to `grid`; `pick` → *node* → **issues** and props without data from the API.',
  'to-props-throws': '*sections* → `✗ 1 node has issues`, `list shortcuts.0: toProps("list") threw: …`. *tree* → `!` next to `list`.',
  'to-props-non-object': '*sections* → `✗ 2 nodes have issues`, `toProps("badge") must return an object, got string …`. The badges on the page are empty — they got the props from the layout.',
  'data-without-node': '*sections* → the page issue `✗ news.0.7 data for an ID that has no node in the layout — layout and data are out of sync`.',

  // devtools
  panel:
    'Go through them in order: `pick` and click a card (*node*), *tree* — type an article title into the search field, *sections* — bindings, *timing* — timings, `copy report` — paste the report into a text editor.',
  timing: '*timing* → `related` (150 ms) marked `slowest`, `header` (40 ms) and `page data` shorter — all bars start at the same point, because the loaders run in parallel.',
  'timing-sequential':
    '*timing* → the `sequential` loader ~200 ms (`slowest`): its query `latest-a` starts at ~0 ms, `popular-a` — about 100 ms later, when the first one ends. The `parallel` loader ~100 ms: both queries (`latest-b`, `popular-b`) start at the same moment. All queries are `miss` (an empty instance).',
  'no-trace':
    '*sections* → `· built without trace — …`. *timing* → `No timings`. `pick` on a card → the props from the layout have no source (without trace the build doesn\'t record `← default` / `← template` / `← patch`); `← data` remains, because this view runs `resolve` with trace.',
}

/** For cases that throw: the panel has nothing to show — explain it instead of a hint. */
export const LIVE_THROWS =
  'The devtools panel is empty here — the build (or `resolve`) failed, so there\'s no payload on the page. In the app you\'re left with the exception message: the server log, the error overlay in Next — the same one you see below in "thrown error".'
