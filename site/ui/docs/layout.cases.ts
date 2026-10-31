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
        props: { title: 'Latest' },
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
        'hero > :slot(actions)': [{ label: 'Read' }, { label: 'All' }],
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
    section('news', cards(ui, 'Latest', 3)),
    // removing the root removes the whole section — e.g. a section hidden in some variant
    section('promo', cards(ui, 'Promotions', 3), { remove: ':root' }),
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

// #region template-contract
// a stored template with mistakes, used without ui.validate — devtools check it against the contract anyway
const stored = JSON.parse(`{
  "component": "section",
  "props": { "title": "Latest" },
  "children": [
    { "component": "grid", "props": { "columns": 6 }, "children": [
      { "component": "card", "repeat": 3, "props": { "size": "xl" }, "slots": { "badges": { "component": "badge" } } }
    ] }
  ]
}`)

const templateContract = ui.page<Ctx>({
  sections: [section('news', stored)],
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

export const layoutCases: DocCase[] = [
  {
    slug: 'blocks-repeat',
    title: 'Blocks and repeat',
    level: 'ok',
    description:
      'Layout is a tree of nodes: `node(component, { props, children, slots, alias })`. `repeat(node, n)` duplicates a node `n` times — each copy gets its own ID (`news.0.0`, `news.0.1`…).\n\nA block is a plain value or a function — you can parametrise it and compose it from smaller blocks.',
    run: build(ui, blocksRepeat),
  },
  {
    slug: 'slots',
    title: 'Slots',
    level: 'ok',
    description:
      'A slot is a place in a component for another component (a prop of type `Slot` in the contract). A single slot — one node (`media`); a list slot — an array of nodes (`actions`).\n\nData is assigned to slots with the `:slot(name)` selector, e.g. `card > :slot(badge)`. The renderer passes slots as props holding React elements.',
    run: build(ui, slots),
  },
  {
    slug: 'aliases',
    title: 'Aliases',
    level: 'ok',
    description:
      'An alias (`alias: "featured"`) names a node in a block — the selector `#featured` hits it regardless of its position. Useful for featured spots: data, patch.\n\nA specific binding (`#featured`) goes before a general one (`card`) — a node taken by an earlier binding is skipped by the later ones.',
    run: build(ui, aliases),
  },
  {
    slug: 'patch-selectors',
    title: 'Patch and selectors',
    level: 'ok',
    description:
      '`patch` in a section applies props to the nodes matched by selectors in CSS syntax:\n\n- component: `card`; alias: `#featured`; section root: `:root`\n- position: `:first-child`, `:last-child`, `:nth-child(even)`, `:nth-child(3n+1)`\n- a prop from the layout: `[size=lg]`, `[size]`\n- child and descendant: `grid > card`, `section card`; slot: `:slot(badge)`\n\nSelectors are matched against the tree before patching — `[size=lg]` sees a `size` set in the block, but not one set by another patch. In devtools, next to a prop you can see which patch set it (`← patch card:last-child`).',
    run: build(ui, patchSelectors),
  },
  {
    slug: 'patch-no-match',
    title: 'Patch that matches nothing',
    level: 'warning',
    description:
      'A patch selector that matches no node (a typo, a changed block) changes nothing — the page works, but the patch has no effect.\n\nDevtools (*sections*): `! patch “crad” matches no node in this section — it has no effect. Did you mean: card?` — the suggestion is a corrected selector that does match. The same goes for `remove`.',
    run: build(ui, patchNoMatch),
  },
  {
    slug: 'remove',
    title: 'Remove',
    level: 'ok',
    description:
      '`remove` in a section removes the nodes matched by selectors (together with their subtree, slots included) — before `patch` and before data is assigned. This lets the same block have a compact variant.',
    run: build(ui, remove),
  },
  {
    slug: 'remove-root',
    title: 'Removing the section root',
    level: 'warning',
    description:
      '`remove: ":root"` removes the section root, i.e. the whole section. Its loader doesn\'t run; page data under its key would end up in `unknownData`.\n\nDevtools (*sections*): `! promo removed — the section\'s remove option removed its root`; in the report: `report.removedSections`.',
    run: build(ui, removeRoot),
  },
  {
    slug: 'variants',
    title: 'Variants (ctx)',
    level: 'ok',
    description:
      '`sections` can be a function of `ctx` — different blocks, props or a set of sections per variant (here `device: "mobile"`: 1 column, 2 cards). `ctx` should be serializable; if the page has `cache`, `cache.key(ctx)` must include whatever the variants depend on (here `device`).',
    run: build(ui, variants, { device: 'mobile' }),
  },
  {
    slug: 'template-contract',
    title: 'A template that doesn\'t match the contract',
    level: 'error',
    description: `A template from outside the code — a database, a CMS, a Figma export — isn't checked by the compiler. With the contract as a value (\`createDedal({ contract })\`), a **debug build checks every template against it**: the section blocks, the placeholders of deferred sections and the \`onEmpty\` blocks. Problems are reported, not thrown — the page still renders, so you see the result and the cause side by side.

Here the stored template has three mistakes: \`columns: 6\` (the contract allows 1–4), \`size: "xl"\` (sm, md or lg) and a slot \`badges\` (the card's slot is \`badge\`). Devtools list each with its path — \`news.children[0].children[0].slots.badges\` — and suggest the slot name.

In production, check templates before they reach a page: \`ui.validate\` / \`ui.validateSections\` when a template is saved and when it's loaded (*Templates in a database or CMS*).`,
    run: build(ui, templateContract),
  },
]
