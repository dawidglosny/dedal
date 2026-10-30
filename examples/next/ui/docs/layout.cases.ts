import type { Ctx } from '../contract'
import { articles, build, cards, ui } from './shared'
import type { DocCase } from './types'

const { node, repeat, section } = ui

// #region blocks-repeat
const blocksRepeat = ui.page<Ctx>({
  sections: [
    section(
      'news',
      node('section', {
        props: { title: 'Najnowsze' },
        children: [node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] })],
      })
    ),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region slots
const slots = ui.page<Ctx>({
  sections: [
    section(
      'hero',
      node('hero', {
        // single slot: one node; list slot: an array of nodes
        slots: { media: node('image'), actions: [node('button'), node('button', { props: { variant: 'outline' } })] },
      })
    ),
    section(
      'news',
      node('grid', {
        props: { columns: 3 },
        children: [repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), 3)],
      })
    ),
  ],
  data: async () => {
    const [featured, ...rest] = await articles(4)
    return {
      hero: {
        hero: [featured],
        image: [featured],
        'hero > :slot(actions)': [{ label: 'Czytaj' }, { label: 'Wszystkie' }],
      },
      news: {
        card: rest,
        // data for slots — selected like any other node
        'card > :slot(badge)': rest.map(article => article.category),
        'card > :slot(footer)': rest.map(article => article.author),
      },
    }
  },
})
// #endregion

// #region aliases
const aliases = ui.page<Ctx>({
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
    const [featured, ...rest] = await articles(3)
    // the specific binding (#featured) before the general one (card) — it claims its node first
    return { news: { '#featured': [featured], card: rest } }
  },
})
// #endregion

// #region patch-selectors
const patchSelectors = ui.page<Ctx>({
  sections: [
    section(
      'news',
      node('grid', {
        props: { columns: 3 },
        children: [
          node('card', { props: { size: 'lg' }, slots: { badge: node('badge') } }), // size set in the block
          repeat(node('card', { slots: { badge: node('badge') } }), 5),
        ],
      }),
      {
        patch: {
          ':root': { gap: 'lg' }, // the section root
          'card:last-child': { size: 'sm' }, // position
          'card:nth-child(even) > :slot(badge)': { variant: 'outline' }, // even cards, their badge slot
          'card[size=lg] > :slot(badge)': { variant: 'default' }, // by a prop from the layout (block, not another patch)
        },
      }
    ),
  ],
  data: async () => {
    const list = await articles(6)
    return { news: { card: list, 'card > :slot(badge)': list.map(article => article.category) } }
  },
})
// #endregion

// #region patch-no-match
const patchNoMatch = ui.page<Ctx>({
  sections: [
    section('news', node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] }), {
      patch: { crad: { size: 'sm' } }, // typo: there is no "crad" component
    }),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region remove
const remove = ui.page<Ctx>({
  sections: [
    section(
      'news',
      node('grid', {
        props: { columns: 3 },
        children: [repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), 3)],
      }),
      // a compact variant of the same block: without the author footer
      { remove: 'card > :slot(footer)' }
    ),
  ],
  data: async () => {
    const list = await articles(3)
    return { news: { card: list, 'card > :slot(badge)': list.map(article => article.category) } }
  },
})
// #endregion

// #region remove-root
const removeRoot = ui.page<Ctx>({
  sections: [
    section('news', cards(ui, 'Najnowsze', 3)),
    // removing the root removes the whole section — e.g. a section hidden in some variant
    section('promo', cards(ui, 'Promocje', 3), { remove: ':root' }),
  ],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region variants
const variants = ui.page<Ctx>({
  // sections depend on ctx: other blocks and props per device
  sections: ({ device }) => [
    section(
      'news',
      node('grid', {
        props: { columns: device === 'mobile' ? 1 : 3 },
        children: [repeat(node('card'), device === 'mobile' ? 2 : 3)],
      })
    ),
  ],
  data: async ({ device }) => ({ news: { card: await articles(device === 'mobile' ? 2 : 3) } }),
})
// #endregion

export const layoutCases: DocCase[] = [
  {
    slug: 'blocks-repeat',
    title: 'Blocks and repeat',
    level: 'ok',
    description:
      'Layout to drzewo node: `node(component, { props, children, slots, alias })`. `repeat(node, n)` powiela node `n` razy — każda kopia dostaje własne ID (`news.0.0`, `news.0.1`…).\n\nBlok to zwykła wartość albo funkcja — można go parametryzować i składać z mniejszych bloków.',
    run: build(ui, blocksRepeat),
  },
  {
    slug: 'slots',
    title: 'Slots',
    level: 'ok',
    description:
      'Slot to miejsce w komponencie na inny komponent (prop typu `Slot` w kontrakcie). Pojedynczy slot — jeden node (`media`), slot-lista — tablica node (`actions`).\n\nData do slotów przypisuje się selektorem `:slot(nazwa)`, np. `card > :slot(badge)`. Renderer przekazuje sloty jako propsy-elementy React.',
    run: build(ui, slots),
  },
  {
    slug: 'aliases',
    title: 'Aliases',
    level: 'ok',
    description:
      'Alias (`alias: "featured"`) nazywa node w bloku — selektor `#featured` trafia w niego niezależnie od pozycji. Przydaje się do wyróżnionych miejsc: data, patch.\n\nBinding szczegółowy (`#featured`) wpisuje się przed ogólnym (`card`) — węzeł zajęty przez wcześniejszy binding jest pomijany przez kolejne.',
    run: build(ui, aliases),
  },
  {
    slug: 'patch-selectors',
    title: 'Patch and selectors',
    level: 'ok',
    description:
      '`patch` w section nakłada props na node trafione selektorami w składni CSS:\n\n- component: `card`; alias: `#featured`; korzeń section: `:root`\n- pozycja: `:first-child`, `:last-child`, `:nth-child(even)`, `:nth-child(3n+1)`\n- prop z layoutu: `[size=lg]`, `[size]`\n- dziecko i potomek: `grid > card`, `section card`; slot: `:slot(badge)`\n\nSelektory dopasowuje się do drzewa przed patchem — `[size=lg]` widzi `size` ustawiony w bloku, ale nie przez inny patch. W devtools przy propsie widać, który patch go ustawił (`← patch card:last-child`).',
    run: build(ui, patchSelectors),
  },
  {
    slug: 'patch-no-match',
    title: 'Patch that matches nothing',
    level: 'warning',
    description:
      'Selector patcha, który nie trafia w żaden node (literówka, zmieniony blok), nie zmienia niczego — strona działa, ale patch nie ma efektu.\n\nDevtools (*sections*): `! patch “crad” matches no node in this section — it has no effect. Did you mean: card?` — podpowiedź to poprawiony selector, który trafia. Tak samo dla `remove`.',
    run: build(ui, patchNoMatch),
  },
  {
    slug: 'remove',
    title: 'Remove',
    level: 'ok',
    description:
      '`remove` w section usuwa node trafione selektorami (razem z poddrzewem, także ze slotów) — przed `patch` i przed przypisaniem data. Ten sam blok może dzięki temu mieć wariant kompaktowy.',
    run: build(ui, remove),
  },
  {
    slug: 'remove-root',
    title: 'Removing the section root',
    level: 'warning',
    description:
      '`remove: ":root"` usuwa korzeń section, czyli całą section. Jej loader się nie wykonuje; data strony pod jej key trafiłyby do `unknownData`.\n\nDevtools (*sections*): `! promo removed — the section\'s remove option removed its root`; w raporcie `report.removedSections`.',
    run: build(ui, removeRoot),
  },
  {
    slug: 'variants',
    title: 'Variants (ctx)',
    level: 'ok',
    description:
      '`sections` może być funkcją `ctx` — inne bloki, props albo zestaw section per wariant (tu `device: "mobile"`: 1 kolumna, 2 card). `ctx` powinien być serializowalny; jeśli strona ma `cache`, `cache.key(ctx)` musi uwzględnić to, od czego zależą warianty (tu `device`).',
    run: build(ui, variants, { device: 'mobile' }),
  },
]
