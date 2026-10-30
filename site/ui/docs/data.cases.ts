import type { Ctx } from '../contract'
import { articles, build, cards, ui } from './shared'
import type { DocCase } from './types'

const { node, repeat, section } = ui

// #region bindings
const bindings = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  // data: section key → { selector: items }; items go to the matched nodes in tree order
  data: async () => {
    const list = await articles(3)
    return {
      news: {
        card: list,
        'card > :slot(badge)': list.map(article => article.category),
      },
    }
  },
})
// #endregion

// #region to-props
// ui/dedal.ts — instance options shared by all pages:
//   defaults: { card: { size: 'md' }, badge: { variant: 'secondary' } }
//   toProps: { card: ({ props, data }) => (data ? { ...props, title: data.headline, href: `/article/${data.slug}`, … } : props) }
const toPropsPage = ui.page<Ctx>({
  sections: [section('news', node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] }))],
  // data in the shape of the API (Article) — toProps maps it to the contract props (title, href, image…)
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region null-items
const nullItems = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  data: async () => {
    const [first, , third] = await articles(3)
    // null = no data for this node: with the default onShortage: 'remove' the node disappears
    return { news: { card: [first, null, third] } }
  },
})
// #endregion

// #region shortage-remove
const shortageRemove = ui.page<Ctx>({
  sections: [section('news', cards(ui, '2 articles for 4 places', 4))],
  // default onShortage: 'remove' — nodes without data are removed
  data: async () => ({ news: { card: await articles(2) } }),
})
// #endregion

// #region shortage-keep
const shortageKeep = ui.page<Ctx>({
  sections: [section('news', cards(ui, '2 articles for 4 places', 4), { policies: { onShortage: 'keep' } })],
  // onShortage: 'keep' — nodes without data stay (layout props only), e.g. placeholders
  data: async () => ({ news: { card: await articles(2) } }),
})
// #endregion

// #region surplus
const surplus = ui.page<Ctx>({
  sections: [section('news', cards(ui, '6 articles for 3 places', 3))],
  // default onSurplus: 'ignore' — the surplus is skipped and listed in devtools
  data: async () => ({ news: { card: await articles(6) } }),
})
// #endregion

// #region binding-no-match
const bindingNoMatch = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  // typo: "crad" — no node matches, the section gets no data and is removed (onEmpty)
  data: async () => ({ news: { crad: await articles(3) } }),
})
// #endregion

// #region binding-order
const bindingOrder = ui.page<Ctx>({
  sections: [
    section(
      'news',
      node('grid', {
        props: { columns: 3 },
        children: [node('card', { alias: 'featured', props: { size: 'lg' } }), repeat(node('card'), 2)],
      })
    ),
  ],
  data: async () => {
    const list = await articles(4)
    // the general "card" first takes all three cards (also #featured) — "#featured" gets nothing
    return { news: { card: list.slice(0, 3), '#featured': [list[3]] } }
  },
})
// #endregion

// #region dropped
const dropped = ui.page<Ctx>({
  sections: [
    section(
      'news',
      node('section', {
        props: { title: 'Latest' },
        children: [
          node('grid', { props: { columns: 2 }, children: [repeat(node('card'), 2)] }),
          node('grid', { alias: 'more', props: { columns: 2 }, children: [repeat(node('card'), 2)] }),
        ],
      })
    ),
  ],
  data: async () => ({
    news: {
      '#more': [null], // no data for the "more" grid → removed (onShortage: 'remove')…
      card: await articles(4), // …together with the two cards inside, although they got data
    },
  }),
})
// #endregion

export const dataCases: DocCase[] = [
  {
    slug: 'bindings',
    title: 'Bindings',
    level: 'ok',
    description:
      'Page data is `{ sectionKey: { selector: items } }`. Each entry is a binding: the selector picks nodes in the section, and consecutive items go to consecutive matched nodes in tree order (slots before children).\n\nData never crosses between sections — the section key is explicit. A binding can have its own rules: `{ items, onShortage, onSurplus }`.',
    run: build(ui, bindings),
  },
  {
    slug: 'to-props',
    title: 'toProps and defaults',
    level: 'ok',
    description:
      'Data can have the shape of the API rather than the component\'s props. `toProps` (an instance option) maps it, per component, to the contract props — a pure module without IO that works on the server and on the frontend.\n\n`defaults` are default component props — `node()` adds them when the block is created. Precedence: `defaults` → props from the layout (block, patch) → data. `toProps` gets the props from the layout and the data, and its result is the final props (hence `...props` in the mapping); without `toProps` data is merged into props (deep merge). In devtools, next to each prop you can see its source: `← default`, `← template`, `← patch …`, `← data`.',
    run: build(ui, toPropsPage),
  },
  {
    slug: 'null-items',
    title: 'null items',
    level: 'warning',
    description:
      '`null` (or `undefined`) in the list means "no data for this node" — e.g. when the API returns a gap. Such a node is subject to `onShortage`, just like with a list that\'s too short.\n\nDevtools: `! card — 3 data items for 3 nodes (1 null)` and `1 node removed — nothing to fill it with`.',
    run: build(ui, nullItems),
  },
  {
    slug: 'shortage-remove',
    title: 'Missing data (remove)',
    level: 'warning',
    description:
      'Less data than nodes. The default `onShortage: "remove"` removes nodes without data — the section shows as many cards as there are items.\n\nDevtools: `! card — 2 data items for 4 nodes`, `2 nodes removed — nothing to fill them with (onShortage: \'remove\')`.',
    run: build(ui, shortageRemove),
  },
  {
    slug: 'shortage-keep',
    title: 'Missing data (keep)',
    level: 'warning',
    description:
      '`onShortage: "keep"` (in the `policies` of a section, the instance or a binding) keeps nodes without data — with only the props from the layout. Useful for fixed places (e.g. a placeholder). `"error"` turns the shortage into an exception (see *Errors*).\n\nDevtools: `2 nodes left empty (onShortage: \'keep\')`; in *tree*, cards without ●.',
    run: build(ui, shortageKeep),
  },
  {
    slug: 'surplus',
    title: 'Unused data',
    level: 'warning',
    description:
      'More data than nodes — the surplus is skipped (`onSurplus: "ignore"`). Devtools show which items didn\'t fit: `3 data items not shown — no node left for them:` followed by a list with the index and a summary.\n\n`onSurplus: "error"` turns the surplus into an exception.',
    run: build(ui, surplus),
  },
  {
    slug: 'binding-no-match',
    title: 'Binding that matches nothing',
    level: 'error',
    description:
      'The binding\'s selector matches no node (a typo, a changed block) — the data never reaches the page. When it\'s the only binding, the section gets nothing and disappears (`onEmpty`).\n\nDevtools: `✗ crad — 3 data items for 0 nodes`, `No node in this section matches “crad” — the data is not shown. Did you mean: card?`; the section appears in *sections* and *tree* as "removed — no data", with the layout from before `assign`.',
    run: build(ui, bindingNoMatch),
  },
  {
    slug: 'binding-order',
    title: 'Binding order',
    level: 'error',
    description:
      'A node taken by an earlier binding is skipped by the later ones. The general `card` placed before the specific `#featured` takes all the cards — `#featured` gets nothing.\n\nDevtools: `“#featured” matches nodes already filled by “card” — the data is not shown. Move “#featured” before “card” in this section’s data.`',
    run: build(ui, bindingOrder),
  },
  {
    slug: 'dropped',
    title: 'Dropped data',
    level: 'warning',
    description:
      'When `onShortage: "remove"` removes a node, its descendants disappear too — along with the data they got. Here the `#more` grid got no data, so it disappeared together with its two cards, even though they had articles.\n\nDevtools: `news.1.0, news.1.1 had data, but their parent news.1 was removed (nothing to fill it with) — the data is not shown.`',
    run: build(ui, dropped),
  },
]
