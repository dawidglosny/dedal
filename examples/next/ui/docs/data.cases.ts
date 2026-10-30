import type { Ctx } from '../contract'
import { articles, build, cards, ui } from './shared'
import type { DocCase } from './types'

const { node, repeat, section } = ui

// #region bindings
const bindings = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
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
//   toProps: { card: ({ props, data }) => (data ? { ...props, title: data.headline, href: `/artykul/${data.slug}`, … } : props) }
const toPropsPage = ui.page<Ctx>({
  sections: [section('news', node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] }))],
  // data in the shape of the API (Article) — toProps maps it to the contract props (title, href, image…)
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region null-items
const nullItems = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
  data: async () => {
    const [first, , third] = await articles(3)
    // null = no data for this node: with the default onShortage: 'remove' the node disappears
    return { news: { card: [first, null, third] } }
  },
})
// #endregion

// #region shortage-remove
const shortageRemove = ui.page<Ctx>({
  sections: [section('news', cards(ui, '2 artykuły na 4 miejsca', 4))],
  // default onShortage: 'remove' — nodes without data are removed
  data: async () => ({ news: { card: await articles(2) } }),
})
// #endregion

// #region shortage-keep
const shortageKeep = ui.page<Ctx>({
  sections: [section('news', cards(ui, '2 artykuły na 4 miejsca', 4), { policies: { onShortage: 'keep' } })],
  // onShortage: 'keep' — nodes without data stay (layout props only), e.g. placeholders
  data: async () => ({ news: { card: await articles(2) } }),
})
// #endregion

// #region surplus
const surplus = ui.page<Ctx>({
  sections: [section('news', cards(ui, '6 artykułów na 3 miejsca', 3))],
  // default onSurplus: 'ignore' — the surplus is skipped and listed in devtools
  data: async () => ({ news: { card: await articles(6) } }),
})
// #endregion

// #region binding-no-match
const bindingNoMatch = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
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
        props: { title: 'Najnowsze' },
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
      'Data strony to `{ kluczSection: { selector: items } }`. Każdy wpis to binding: selector wybiera node w section, a kolejne items trafiają do kolejnych trafionych node w kolejności drzewa (sloty przed children).\n\nData nigdy nie przechodzą między section — key section jest jawny. Binding może mieć własne zasady: `{ items, onShortage, onSurplus }`.',
    run: build(ui, bindings),
  },
  {
    slug: 'to-props',
    title: 'toProps and defaults',
    level: 'ok',
    description:
      'Data mogą mieć kształt API, a nie propsów komponentu. `toProps` (opcja instancji) mapuje je per component na propsy kontraktu — czysty moduł bez IO, działa na serwerze i na froncie.\n\n`defaults` to domyślne props component — `node()` dokłada je przy tworzeniu bloku. Pierwszeństwo: `defaults` → props z layoutu (blok, patch) → data. `toProps` dostaje props z layoutu i data, a jego wynik to ostateczne props (stąd `...props` w mapowaniu); bez `toProps` data są łączone z props (deep merge). W devtools przy propsie widać źródło: `← default`, `← template`, `← patch …`, `← data`.',
    run: build(ui, toPropsPage),
  },
  {
    slug: 'null-items',
    title: 'null items',
    level: 'warning',
    description:
      '`null` (albo `undefined`) w liście oznacza „brak data dla tego node” — np. gdy API zwróci dziurę. Taki node podlega `onShortage` jak przy zbyt krótkiej liście.\n\nDevtools: `! card — 3 data items for 3 nodes (1 null)` i `1 node removed — nothing to fill it with`.',
    run: build(ui, nullItems),
  },
  {
    slug: 'shortage-remove',
    title: 'Missing data (remove)',
    level: 'warning',
    description:
      'Mniej data niż node. Domyślne `onShortage: "remove"` usuwa node bez data — section pokazuje tyle card, ile przyszło.\n\nDevtools: `! card — 2 data items for 4 nodes`, `2 nodes removed — nothing to fill them with (onShortage: \'remove\')`.',
    run: build(ui, shortageRemove),
  },
  {
    slug: 'shortage-keep',
    title: 'Missing data (keep)',
    level: 'warning',
    description:
      '`onShortage: "keep"` (w `policies` section, instancji albo bindingu) zostawia node bez data — z samymi propsami z layoutu. Przydatne dla stałych miejsc (np. placeholder). `"error"` zamienia brak w wyjątek (zob. *Errors*).\n\nDevtools: `2 nodes left empty (onShortage: \'keep\')`; w *tree* card bez ●.',
    run: build(ui, shortageKeep),
  },
  {
    slug: 'surplus',
    title: 'Unused data',
    level: 'warning',
    description:
      'Więcej data niż node — nadmiar jest pomijany (`onSurplus: "ignore"`). Devtools pokazują, które items się nie zmieściły: `3 data items not shown — no node left for them:` i lista z indeksem i skrótem.\n\n`onSurplus: "error"` zamienia nadmiar w wyjątek.',
    run: build(ui, surplus),
  },
  {
    slug: 'binding-no-match',
    title: 'Binding that matches nothing',
    level: 'error',
    description:
      'Selector bindingu nie trafia w żaden node (literówka, zmieniony blok) — data nie trafiają na stronę. Gdy to jedyny binding, section nie dostaje nic i znika (`onEmpty`).\n\nDevtools: `✗ crad — 3 data items for 0 nodes`, `No node in this section matches “crad” — the data is not shown. Did you mean: card?`; section w *sections* i *tree* jako „removed — no data”, z layoutem sprzed `assign`.',
    run: build(ui, bindingNoMatch),
  },
  {
    slug: 'binding-order',
    title: 'Binding order',
    level: 'error',
    description:
      'Node zajęty przez wcześniejszy binding jest pomijany przez kolejne. Ogólny `card` wpisany przed szczegółowym `#featured` zabiera wszystkie card — `#featured` nic nie dostaje.\n\nDevtools: `“#featured” matches nodes already filled by “card” — the data is not shown. Move “#featured” before “card” in this section’s data.`',
    run: build(ui, bindingOrder),
  },
  {
    slug: 'dropped',
    title: 'Dropped data',
    level: 'warning',
    description:
      'Gdy `onShortage: "remove"` usuwa node, znikają też jego potomkowie — razem z data, które dostali. Tu grid `#more` nie dostał data, więc zniknął z dwiema card, choć te miały artykuły.\n\nDevtools: `news.1.0, news.1.1 had data, but their parent news.1 was removed (nothing to fill it with) — the data is not shown.`',
    run: build(ui, dropped),
  },
]
