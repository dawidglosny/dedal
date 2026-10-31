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
