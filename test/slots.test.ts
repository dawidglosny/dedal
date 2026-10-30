import { describe, expect, it } from 'vitest'
import { layout, parseSelector } from '../src'
import { node, repeat, ui } from './fixtures'

/*
 * p                         grid
 * ├ p.0                     profile
 * │ └ p.0:cover   image        (slot)
 * ├ p.1                     tabs
 * │ ├ p.1:content.0         heading             (slot list)
 * │ │ └ p.1:content.0:actions   card       (slot in a slot)
 * │ ├ p.1:content.1         card
 * │ └ p.1:content.2         card
 * └ p.2                     card
 */
const build = () =>
  ui.layout(
    node('grid', {
      children: [
        node('profile', { slots: { cover: node('image', { props: { width: '100%' } }) } }),
        node('tabs', {
          props: { labels: ['A', 'B', 'C'] },
          slots: {
            content: [
              node('heading', { slots: { actions: node('card') } }),
              repeat(node('card', { props: { size: 'small' } }), 2),
            ],
          },
        }),
        node('card'),
      ],
    }),
    'p'
  )

const ids = (selector: string) => ui.select(build(), selector).map(n => n.id)

describe('sloty w layout()', () => {
  it('nadaje ID zawartości slotów', () => {
    const root = build()
    const [profileNode, tabs] = root.children!

    expect(profileNode.slots).toEqual({
      cover: {
        id: 'p.0:cover',
        component: 'image',
        props: expect.objectContaining({ width: '100%' }),
      },
    })
    expect((tabs.slots!.content as { id: string }[]).map(n => n.id)).toEqual([
      'p.1:content.0',
      'p.1:content.1',
      'p.1:content.2',
    ])
  })

  it('obsługuje sloty w slotach', () => {
    const header = (build().children![1].slots!.content as { slots?: Record<string, { id: string }> }[])[0]

    expect(header.slots!.actions.id).toBe('p.1:content.0:actions')
  })

  it('pomija sloty ustawione na undefined', () => {
    expect(layout(node('profile', { slots: { cover: undefined } }), 's')).toEqual({
      id: 's',
      component: 'profile',
      props: {},
    })
  })

  it('odrzuca repeat > 1 w slocie pojedynczym', () => {
    expect(() =>
      layout(node('profile', { slots: { cover: repeat(node('image'), 2) } }), 's')
    ).toThrow('slot "cover"')
  })

  it('przekazuje pozycję w slocie do generatora ID', () => {
    const paths: unknown[] = []
    layout(node('tabs', { slots: { content: [node('card')] } }), 's', {
      id: ctx => {
        paths.push(ctx.path)
        return JSON.stringify(ctx.path)
      },
    })

    expect(paths).toEqual([[], [{ slot: 'content', index: 0 }]])
  })

  it('wynik jest czystym JSON-em (round-trip bez strat)', () => {
    const root = build()

    expect(JSON.parse(JSON.stringify(root))).toEqual(root)
  })
})

describe('selektory a sloty', () => {
  it('kolejność drzewa: sloty przed children', () => {
    expect(ids('*')).toEqual([
      'p',
      'p.0',
      'p.0:cover',
      'p.1',
      'p.1:content.0',
      'p.1:content.0:actions',
      'p.1:content.1',
      'p.1:content.2',
      'p.2',
    ])
  })

  it.each([
    [':slot', ['p.0:cover', 'p.1:content.0', 'p.1:content.0:actions', 'p.1:content.1', 'p.1:content.2']],
    [':slot(content)', ['p.1:content.0', 'p.1:content.1', 'p.1:content.2']],
    ['card:slot(content)', ['p.1:content.1', 'p.1:content.2']],
    ['profile > :slot(cover)', ['p.0:cover']],
    ['profile > image', ['p.0:cover']],
    ['tabs card', ['p.1:content.0:actions', 'p.1:content.1', 'p.1:content.2']],
    ['tabs > card', ['p.1:content.1', 'p.1:content.2']],
    ['tabs > :slot(content):first-child', ['p.1:content.0']],
    ['tabs > :slot(content):nth-child(2)', ['p.1:content.1']],
    ['tabs > :slot(content):last-child', ['p.1:content.2']],
    ['grid > card', ['p.2']],
    ['grid > card:last-child', ['p.2']],
  ] as [string, string[]][])('%s', (selector, expected) => {
    expect(ids(selector)).toEqual(expected)
  })

  it('slot nie wpływa na pozycję children', () => {
    // profile has a slot, but the only children element grid:nth-child(1) is still profile
    expect(ids('grid > :nth-child(1)')).toEqual(['p.0'])
  })

  it.each([':slot(', ':slot()', ':slot(a b)'])('odrzuca "%s"', selector => {
    expect(() => parseSelector(selector)).toThrow(SyntaxError)
  })
})

describe('patch / remove a sloty', () => {
  it('patch trafia w zawartość slotów i nie rusza reszty', () => {
    const root = build()
    const result = ui.patch(root, { 'tabs > :slot(content)': { size: 'large' } })
    const content = result.children![1].slots!.content as { props: Record<string, unknown> }[]

    expect(content.map(n => n.props.size)).toEqual(['large', 'large', 'large'])
    expect(result.children![0]).toBe(root.children![0])
    expect(result.children![2]).toBe(root.children![2])
  })

  it('remove usuwa element slotu-listy', () => {
    const result = ui.remove(build(), 'tabs > :slot(content):nth-child(2)')!

    expect((result.children![1].slots!.content as { id: string }[]).map(n => n.id)).toEqual([
      'p.1:content.0',
      'p.1:content.2',
    ])
  })

  it('remove usuwa slot pojedynczy, a pusty slot znika', () => {
    const result = ui.remove(build(), ':slot(cover)')!

    expect(result.children![0]).toEqual({ id: 'p.0', component: 'profile', props: {} })
  })

  it('remove usuwa cały slot-listę, gdy usunięto wszystkie elementy', () => {
    const result = ui.remove(build(), ':slot(content)')!

    expect(result.children![1].slots).toBeUndefined()
    expect(result.children![1].props).toEqual({ labels: ['A', 'B', 'C'] })
  })

  it('nie mutuje wejścia', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))

    ui.patch(root, { ':slot': { size: 'large' } })
    ui.remove(root, ':slot')

    expect(root).toEqual(snapshot)
  })
})
