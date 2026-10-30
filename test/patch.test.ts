import { describe, expect, it } from 'vitest'
import { layout, patch, remove } from '../src'
import { node, repeat } from './fixtures'

const build = () =>
  layout(
    node('grid', {
      children: [node('heading'), repeat(node('card'), 3), node('stack', { children: [node('card')] })],
    }),
    's'
  )

describe('patch', () => {
  it('nakłada propsy na pasujące węzły', () => {
    const result = patch(build(), { 'grid > card': { size: 'small' } })

    expect(result.children!.slice(1, 4).map(card => card.props)).toEqual([
      { size: 'small', variant: 'vertical', testId: 'article' },
      { size: 'small', variant: 'vertical', testId: 'article' },
      { size: 'small', variant: 'vertical', testId: 'article' },
    ])
    expect(result.children![4].children![0].props).toMatchObject({ size: 'medium' })
  })

  it('późniejszy wpis wygrywa', () => {
    const result = patch(build(), {
      card: { size: 'small' },
      'card:nth-child(2)': { size: 'large' },
    })

    expect(result.children!.map(child => (child.props as { size?: string }).size)).toEqual([
      'medium',
      'large',
      'small',
      'small',
      undefined,
    ])
  })

  it('dopasowuje do drzewa wejściowego, nie do wyniku wcześniejszych wpisów', () => {
    const result = patch(build(), {
      card: { size: 'small' },
      '[size=small]': { variant: 'overlay' },
    })

    expect(result.children![1].props).toMatchObject({ size: 'small', variant: 'vertical' })
  })

  it('łączy propsy głęboko', () => {
    const root = layout(node('stack', { props: { style: { height: 'auto', width: '100%' } } }), 's')

    expect(patch(root, { '*': { style: { height: 'max-content' } } }).props).toEqual({
      style: { height: 'max-content', width: '100%' },
    })
  })

  it('nie mutuje wejścia i współdzieli niezmienione poddrzewa', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))
    const result = patch(root, { 'heading': { size: 'large' } })

    expect(root).toEqual(snapshot)
    expect(result).not.toBe(root)
    expect(result.children![1]).toBe(root.children![1])
    expect(result.children![4]).toBe(root.children![4])
  })

  it('zwraca to samo drzewo, gdy nic nie pasuje', () => {
    const root = build()

    expect(patch(root, { '#missing': { size: 'large' } })).toBe(root)
  })
})

describe('remove', () => {
  it('usuwa węzły razem z poddrzewem', () => {
    const result = remove(build(), 'stack')!

    expect(result.children!.map(child => child.id)).toEqual(['s.0', 's.1', 's.2', 's.3'])
  })

  it('przyjmuje listę selektorów i dopasowuje do drzewa wejściowego', () => {
    // after removing s.1, card s.2 doesn't become :nth-child(2) — positions are counted in the input
    const result = remove(build(), ['card:nth-child(2)', 'card:nth-child(3)'])!

    expect(result.children!.map(child => child.id)).toEqual(['s.0', 's.3', 's.4'])
  })

  it('pomija children, gdy usunięto wszystkie dzieci', () => {
    const root = layout(node('stack', { children: [node('card')] }), 's')

    expect(remove(root, 'card')).toEqual({ id: 's', component: 'stack', props: {} })
  })

  it('zwraca null, gdy usunięto korzeń', () => {
    expect(remove(build(), 'grid')).toBeNull()
  })

  it('nie mutuje wejścia i zwraca to samo drzewo, gdy nic nie pasuje', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))

    remove(root, 'card')
    expect(root).toEqual(snapshot)
    expect(remove(root, '#missing')).toBe(root)
  })
})
