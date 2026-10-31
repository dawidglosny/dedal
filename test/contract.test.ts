/**
 * A contract defined as a value (schemas) — the inferred type must work with every existing type unchanged.
 * Type assertions are checked by `npm run typecheck`; the runtime part by vitest.
 */
import * as v from 'valibot'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { createDedal, defineContract, type BlockDefinition, type InferContract, type PropsOf, type Slot, type SlotName } from '../src'
import type { Registry } from '../src/react'

// the same contract as a hand-written type …
type Expected = {
  grid: { columns?: 1 | 2 | 3 | 4 }
  card: { title: string; href?: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot; footer?: Slot }
  tabs: { labels: string[]; content?: Slot[] }
  divider: {} // a component without props
}

// … with zod
const withZod = defineContract({
  grid: { props: z.object({ columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional() }) },
  card: {
    props: z.object({ title: z.string(), href: z.string().optional(), size: z.enum(['sm', 'md', 'lg']).optional() }),
    slots: { badge: 'one', footer: 'one' },
  },
  tabs: { props: z.object({ labels: z.array(z.string()) }), slots: { content: 'many' } },
  divider: {},
})

// … and with valibot
const withValibot = defineContract({
  grid: { props: v.object({ columns: v.optional(v.picklist([1, 2, 3, 4])) }) },
  card: {
    props: v.object({ title: v.string(), href: v.optional(v.string()), size: v.optional(v.picklist(['sm', 'md', 'lg'])) }),
    slots: { badge: 'one', footer: 'one' },
  },
  tabs: { props: v.object({ labels: v.array(v.string()) }), slots: { content: 'many' } },
  divider: {},
})

type FromZod = InferContract<typeof withZod>
type FromValibot = InferContract<typeof withValibot>

describe('defineContract', () => {
  it('infers the same contract as a hand-written type (zod, valibot)', () => {
    expectTypeOf<FromZod>().toEqualTypeOf<Expected>()
    expectTypeOf<FromValibot>().toEqualTypeOf<Expected>()
  })

  it('slots and props are told apart as for a hand-written contract', () => {
    expectTypeOf<SlotName<FromZod, 'card'>>().toEqualTypeOf<'badge' | 'footer'>()
    expectTypeOf<SlotName<FromZod, 'tabs'>>().toEqualTypeOf<'content'>()
    expectTypeOf<PropsOf<FromZod, 'card'>>().toEqualTypeOf<{ title: string; href?: string; size?: 'sm' | 'md' | 'lg' }>()
  })

  it('the builders are typed by the inferred contract', () => {
    const ui = createDedal<FromZod>()
    const block = ui.node('grid', {
      props: { columns: 3 },
      children: [ui.node('card', { props: { title: 'A', size: 'md' }, slots: { badge: ui.node('divider') } })],
    })
    expect(block.component).toBe('grid')

    // @ts-expect-error — a size outside the enum
    ui.node('card', { props: { size: 'xl' } })
    // @ts-expect-error — grid has no title
    ui.node('grid', { props: { title: 'x' } })
    // @ts-expect-error — card has no slot "media"
    ui.node('card', { slots: { media: ui.node('divider') } })
  })

  it('a template literal checks against the inferred contract', () => {
    const template = {
      component: 'tabs',
      props: { labels: ['One', 'Two'] },
      slots: { content: [{ component: 'card', props: { title: 'A' } }, { component: 'divider' }] },
    } satisfies BlockDefinition<FromValibot>
    expect(template.slots.content).toHaveLength(2)
  })

  it('a registry satisfies the inferred contract; slots arrive as React nodes', () => {
    const registry = {
      grid: ({ columns, children }) => ({ columns, children }) as never,
      card: ({ title, badge }) => ({ title, badge }) as never,
      tabs: ({ labels, content }) => ({ labels, content }) as never,
      divider: () => null,
    } satisfies Registry<FromZod>
    expect(Object.keys(registry)).toHaveLength(4)

    // @ts-expect-error — a registry without "divider" doesn't satisfy the contract
    const incomplete = { grid: () => null, card: () => null, tabs: () => null } satisfies Registry<FromZod>
    expect(incomplete).toBeDefined()
  })

  it('the definition is a value: names, slot kinds and schemas are there at runtime', async () => {
    expect(Object.keys(withZod)).toEqual(['grid', 'card', 'tabs', 'divider'])
    expect(withZod.tabs.slots).toEqual({ content: 'many' })

    const ok = await withZod.card.props['~standard'].validate({ title: 'A', size: 'md' })
    const bad = await withValibot.card.props['~standard'].validate({ size: 'xl' })
    expect(ok.issues).toBeUndefined()
    expect(bad.issues?.length).toBeGreaterThan(0)
  })
})

describe('validate', () => {
  const ui = createDedal({ contract: withZod })

  it('a valid template passes and comes back typed by the contract', async () => {
    const result = await ui.validate({
      component: 'grid',
      props: { columns: 2 },
      children: [
        { component: 'card', repeat: 3, props: { size: 'md' }, slots: { badge: { component: 'divider' } } },
        { component: 'tabs', props: { labels: ['A'] }, slots: { content: [{ component: 'card' }] } },
      ],
    })
    expect(result).toEqual({ ok: true, value: expect.objectContaining({ component: 'grid' }), errors: [] })
    if (result.ok) expectTypeOf(result.value).toEqualTypeOf<BlockDefinition<FromZod>>()
  })

  it('props missing from the template are fine — data fills them; props that are there must match', async () => {
    // card requires title, but a template usually leaves it to the data
    expect((await ui.validate({ component: 'card' })).ok).toBe(true)

    const result = await ui.validate({ component: 'card', props: { size: 'xl', href: 42 } })
    expect(result.errors.map(error => error.path).sort()).toEqual(['template.props.href', 'template.props.size'])
  })

  it('every problem has a path, in tree order', async () => {
    const result = await ui.validate(
      {
        component: 'grid',
        children: [
          { component: 'card', slots: { badges: { component: 'divider' } } },
          { component: 'carousel' },
          { component: 'tabs', slots: { content: { component: 'card' } } },
          { component: 'card', slots: { badge: [{ component: 'divider' }] } },
          { component: 'card', repeat: 0, colour: 'red' },
          'card',
        ],
      },
      'news'
    )
    expect(result.errors).toEqual([
      { path: 'news.children[0].slots.badges', message: '"card" has no slot "badges" — did you mean "badge"?' },
      { path: 'news.children[1].component', message: 'unknown component "carousel"' }, // too far from any name for a suggestion
      { path: 'news.children[2].slots.content', message: 'expected a list of blocks (the slot is "many"), got an object' },
      { path: 'news.children[3].slots.badge', message: 'expected one block (the slot is "one"), got an array (1 items)' },
      { path: 'news.children[4].colour', message: 'unknown field "colour" — a block has component, props, slots, children, alias, repeat' },
      { path: 'news.children[4].repeat', message: 'expected an integer >= 1, got number 0' },
      { path: 'news.children[5]', message: 'expected a block (an object with "component"), got string "card"' },
    ])
  })

  it('nested paths reach into slots and props', async () => {
    const result = await ui.validate({
      component: 'tabs',
      slots: { content: [{ component: 'card' }, { component: 'card', props: { size: 'huge' } }] },
    })
    expect(result.errors).toEqual([{ path: 'template.slots.content[1].props.size', message: expect.any(String) }])
  })

  it('works with valibot and with an async schema', async () => {
    const asyncSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: async (value: unknown) =>
          typeof (value as { label?: unknown }).label === 'string' ? { value } : { issues: [{ message: 'label must be a string', path: ['label'] }] },
      },
    } as const
    const contract = defineContract({ badge: { props: asyncSchema }, card: { props: v.object({ title: v.optional(v.string()) }) } })
    const local = createDedal({ contract })

    expect((await local.validate({ component: 'card', props: { title: 1 } })).errors).toEqual([{ path: 'template.props.title', message: expect.any(String) }])
    expect((await local.validate({ component: 'badge', props: { label: 2 } })).errors).toEqual([{ path: 'template.props.label', message: 'label must be a string' }])
  })

  it('validateSections: templates stored per section, paths start with the section key', async () => {
    const result = await ui.validateSections({ news: { component: 'grid' }, hero: { component: 'heroo' } })
    expect(result).toEqual({ ok: false, errors: [{ path: 'hero.component', message: 'unknown component "heroo"' }] })
    expect((await ui.validateSections([])).errors[0].path).toBe('sections')
  })

  it('an instance without a contract value says how to get one', async () => {
    await expect(createDedal<FromZod>().validate({ component: 'card' })).rejects.toThrow('createDedal({ contract')
  })

  it('createDedal({ contract }) is typed by the contract', () => {
    expectTypeOf(ui).toEqualTypeOf<ReturnType<typeof createDedal<FromZod>>>()
    // @ts-expect-error — not in the contract
    ui.node('carousel')
  })
})

describe('async sections — templates from storage', () => {
  const ui = createDedal({ contract: withZod, defaults: { card: { size: 'md' } } })

  // a template store: async, like a database or a CMS
  const stored: Record<string, unknown> = {
    home: { news: { component: 'grid', props: { columns: 2 }, children: [{ component: 'card', repeat: 2 }] } },
  }
  const loads: string[] = []
  const store = {
    get: async (name: string) => (loads.push(name), JSON.parse(JSON.stringify(stored[name]))),
  }

  const home = ui.page<{ name: string }>({
    // the sections come from storage, validated against the contract
    sections: async ({ name }) => {
      const result = await ui.validateSections(await store.get(name))
      if (!result.ok) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('; '))
      return Object.entries(result.value).map(([key, block]) => ui.section(key, block))
    },
    data: async () => ({ news: { card: [{ title: 'A' }, { title: 'B' }] } }),
  })

  it('build, the stages and page.section() all await the sections', async () => {
    loads.length = 0
    const result = await home.build({ name: 'home' })
    const card = result.sections[0].layout.children?.[0]

    expect(card?.props).toEqual({ size: 'md' }) // defaults applied to a template from JSON
    expect(result.data['news.0']).toEqual({ title: 'A' })
    expect(loads).toEqual(['home']) // sections(ctx) once per build

    const { sections } = await home.layout({ name: 'home' })
    expect(await home.assign(sections, await home.load({ name: 'home' }), { name: 'home' })).toEqual(result)
    expect((await home.section('news', { name: 'home' })).sections.map(section => section.key)).toEqual(['news'])
  })

  it('a template that fails validation fails the build, with the path', async () => {
    stored.broken = { news: { component: 'grid', children: [{ component: 'card', props: { size: 'xl' } }] } }
    await expect(home.build({ name: 'broken' })).rejects.toThrow('news.children[0].props.size')
  })

  it('an edit in storage shows on the next build — no page per request needed', async () => {
    stored.home = { news: { component: 'grid', children: [{ component: 'card', repeat: 3 }] } }
    const result = await home.build({ name: 'home' })
    expect(result.sections[0].layout.children).toHaveLength(2) // 3 cards, 2 data items: the third is removed
    expect(result.report.sections.news.removed).toEqual(['news.2'])
  })
})
