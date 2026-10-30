/**
 * Type tests — checked by `npm run typecheck`.
 * Every `@ts-expect-error` must hit an error, otherwise tsc reports an unused directive.
 */
import { describe, expect, it } from 'vitest'
import { createDedal, type BlockDefinition, type LayoutNode, type PropsOf, type Slot, type SlotName } from '../src'
import type { TestComponents } from './fixtures'
import { node, repeat, ui } from './fixtures'

describe('typy', () => {
  it('blok z zagnieżdżonymi siatkami', () => {
    const nestedGrid = node('grid', {
      props: { columns: 2, span: 6 },
      children: [
        node('grid', {
          props: { span: 2 },
          children: [node('card', { props: { variant: 'overlay', size: 'large' } })],
        }),
        node('grid', {
          props: { span: 2, columns: 2 },
          children: [node('card', { repeat: 4, props: { size: 'small' } })],
        }),
      ],
    })

    expect(nestedGrid.children).toHaveLength(2)
  })

  it('odrzuca nieznany komponent', () => {
    // @ts-expect-error — not in the component map
    node('unknown-component')
  })

  it('odrzuca nieznany prop i złą wartość', () => {
    // @ts-expect-error — card has no columns prop
    node('card', { props: { columns: 2 } })
    // @ts-expect-error — disallowed size value
    node('card', { props: { size: 'huge' } })
  })

  it('typuje propsy w literałach BlockDefinition według component', () => {
    const ok: BlockDefinition<TestComponents> = { component: 'card', props: { size: 'small' } }
    // @ts-expect-error — grid props on card
    const bad: BlockDefinition<TestComponents> = { component: 'card', props: { span: 2 } }

    expect([ok, bad]).toHaveLength(2)
  })

  it('repeat zachowuje typ bloku', () => {
    const card = repeat(node('card'), 2)
    const size: 'small' | 'medium' | 'large' | undefined = card.props?.size

    expect(size).toBe('medium')
  })

  it('LayoutNode nie ma repeat', () => {
    const layoutNode: LayoutNode<TestComponents> = { id: 's.0', component: 'card', props: {} }
    // @ts-expect-error — repeat is expanded when the layout is generated
    const withRepeat: LayoutNode<TestComponents> = { id: 's.0', component: 'card', props: {}, repeat: 2 }

    expect([layoutNode, withRepeat]).toHaveLength(2)
  })
})

describe('typy slotów', () => {
  it('sloty są typowane kontraktem', () => {
    node('profile', { slots: { cover: node('image') } })
    node('tabs', { slots: { content: [node('card'), node('heading')] } })

    // @ts-expect-error — a single slot doesn't accept a list
    node('profile', { slots: { cover: [node('image')] } })
    // @ts-expect-error — a slot list requires an array
    node('tabs', { slots: { content: node('card') } })
    // @ts-expect-error — unknown slot
    node('profile', { slots: { media: node('image') } })
    // @ts-expect-error — card has no slots
    node('card', { slots: { cover: node('image') } })
  })

  it('slotów nie da się przekazać przez props', () => {
    // @ts-expect-error — cover is a slot, not a prop
    node('profile', { props: { cover: 'x' } })

    expect(node('profile', { props: { size: 'small' } }).props).toEqual({ size: 'small' })
  })

  it('PropsOf i SlotName rozdzielają kontrakt', () => {
    type Props = PropsOf<TestComponents, 'heading'>
    type Slots = SlotName<TestComponents, 'heading'>

    const props: Props = { size: 'large', title: 'x' }
    const slot: Slots = 'actions'
    // @ts-expect-error — a slot is not part of PropsOf
    const bad: Props = { actions: undefined as never }
    // @ts-expect-error — a prop is not a slot
    const badSlot: Slots = 'title'

    expect([props, slot, bad, badSlot]).toHaveLength(4)
  })
})

describe('typy slotów obok sygnatury indeksu', () => {
  // contract with open props (e.g. components outside our control) and an explicit slot
  type Open = {
    box: { [prop: string]: unknown; media?: Slot; items?: Slot[] }
    image: { [prop: string]: unknown }
  }
  const open = createDedal<Open>()

  it('slot jest rozpoznany mimo sygnatury indeksu', () => {
    const block = open.node('box', {
      props: { anything: 1 },
      slots: { media: open.node('image'), items: [open.node('image'), open.node('image')] },
    })
    const name: SlotName<Open, 'box'> = 'media'
    // @ts-expect-error — unknown slot
    const wrong = open.node('box', { slots: { other: open.node('image') } })
    // @ts-expect-error — a single slot doesn't accept a list
    const wrongShape = open.node('box', { slots: { media: [open.node('image')] } })

    expect([block, name, wrong, wrongShape]).toHaveLength(4)
  })

  it('komponent bez slotów dalej nie przyjmuje slots', () => {
    // @ts-expect-error — image has no slots
    const wrong = open.node('image', { slots: { media: open.node('image') } })

    expect(wrong).toBeDefined()
  })
})

describe('typy select()', () => {
  it('zawęża typ, gdy selektor to nazwa komponentu', () => {
    const root = ui.layout(node('grid', { children: [node('card')] }), 's')
    const [card] = ui.select(root, 'card')
    const size: 'small' | 'medium' | 'large' | undefined = card.props.size
    const [any] = ui.select(root, 'grid > card')
    // @ts-expect-error — a compound selector returns a union of all nodes
    const anySize: string | undefined = any.props.size

    expect([size, anySize]).toHaveLength(2)
  })
})
