import { describe, expect, it } from 'vitest'
import { patch, remove } from '../src'
import { node, repeat, ui } from './fixtures'

const build = () =>
  ui.layout(
    node('grid', {
      children: [node('heading'), repeat(node('card'), 3), node('stack', { children: [node('card')] })],
    }),
    's'
  )

describe('patch', () => {
  it('applies props to matching nodes', () => {
    const result = patch(build(), { 'grid > card': { size: 'small' } })

    expect(result.children!.slice(1, 4).map(card => card.props)).toEqual([
      { size: 'small', variant: 'vertical', testId: 'article' },
      { size: 'small', variant: 'vertical', testId: 'article' },
      { size: 'small', variant: 'vertical', testId: 'article' },
    ])
    expect(result.children![4].children![0].props).toMatchObject({ size: 'medium' })
  })

  it('a later entry wins', () => {
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

  it('matches against the input tree, not the result of earlier entries', () => {
    const result = patch(build(), {
      card: { size: 'small' },
      '[size=small]': { variant: 'overlay' },
    })

    expect(result.children![1].props).toMatchObject({ size: 'small', variant: 'vertical' })
  })

  it('deep-merges props', () => {
    const root = ui.layout(node('stack', { props: { style: { height: 'auto', width: '100%' } } }), 's')

    expect(patch(root, { '*': { style: { height: 'max-content' } } }).props).toEqual({
      style: { height: 'max-content', width: '100%' },
    })
  })

  it('does not mutate the input and shares unchanged subtrees', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))
    const result = patch(root, { 'heading': { size: 'large' } })

    expect(root).toEqual(snapshot)
    expect(result).not.toBe(root)
    expect(result.children![1]).toBe(root.children![1])
    expect(result.children![4]).toBe(root.children![4])
  })

  it('returns the same tree when nothing matches', () => {
    const root = build()

    expect(patch(root, { '#missing': { size: 'large' } })).toBe(root)
  })
})

describe('remove', () => {
  it('removes nodes together with their subtree', () => {
    const result = remove(build(), 'stack')!

    expect(result.children!.map(child => child.id)).toEqual(['s.0', 's.1', 's.2', 's.3'])
  })

  it('accepts a selector list and matches against the input tree', () => {
    // after removing s.1, card s.2 doesn't become :nth-child(2) — positions are counted in the input
    const result = remove(build(), ['card:nth-child(2)', 'card:nth-child(3)'])!

    expect(result.children!.map(child => child.id)).toEqual(['s.0', 's.3', 's.4'])
  })

  it('omits children when all children were removed', () => {
    const root = ui.layout(node('stack', { children: [node('card')] }), 's')

    expect(remove(root, 'card')).toEqual({ id: 's', component: 'stack', props: {} })
  })

  it('returns null when the root was removed', () => {
    expect(remove(build(), 'grid')).toBeNull()
  })

  it('does not mutate the input and returns the same tree when nothing matches', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))

    remove(root, 'card')
    expect(root).toEqual(snapshot)
    expect(remove(root, '#missing')).toBe(root)
  })
})
