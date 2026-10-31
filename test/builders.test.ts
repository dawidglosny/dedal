import { describe, expect, it } from 'vitest'
import { createDedal } from '../src'
import { clone, node, repeat, ui } from './fixtures'

describe('node', () => {
  it('is exactly what was passed — defaults are not baked into the block', () => {
    expect(node('card')).toEqual({ component: 'card', props: {} })
    expect(node('card', { props: { size: 'small' } })).toEqual({ component: 'card', props: { size: 'small' } })
  })

  it('always sets props, and copies them', () => {
    const props = { columns: 2 }
    const block = node('grid', { props })

    expect(node('grid')).toEqual({ component: 'grid', props: {} })
    expect(block.props).toEqual(props)
    expect(block.props).not.toBe(props)
  })
})

describe('defaults (applied by layout)', () => {
  const props = (block: Parameters<typeof ui.layout>[0]) => ui.layout(block, 's').props as Record<string, unknown>

  it('are merged under the block props; the block wins', () => {
    expect(props(node('card'))).toEqual({ size: 'medium', variant: 'vertical', testId: 'article' })
    expect(props(node('card', { props: { size: 'small' } }))).toEqual({ size: 'small', variant: 'vertical', testId: 'article' })
  })

  it('apply the same way to a block from code and to one parsed from JSON', () => {
    const fromJson = JSON.parse('{ "component": "grid", "children": [{ "component": "card", "repeat": 2, "props": { "size": "large" } }] }')
    const fromCode = node('grid', { children: [repeat(node('card', { props: { size: 'large' } }), 2)] })

    expect(ui.layout(fromJson, 's')).toEqual(ui.layout(fromCode, 's'))
    expect(ui.layout(fromJson, 's').children?.[1].props).toEqual({ size: 'large', variant: 'vertical', testId: 'article' })
  })

  it('an array replaces the default instead of being appended to it', () => {
    const sources = [{ minWidth: 990, size: 'lg' }]

    expect(props(node('image', { props: { sources } })).sources).toEqual(sources)
  })

  it('undefined overrides the default value', () => {
    const merged = props(node('image', { props: { sources: undefined } }))

    expect('sources' in merged).toBe(true)
    expect(merged.sources).toBeUndefined()
  })

  it('objects are deep-merged', () => {
    const local = createDedal<{ box: { style?: { color?: string; margin?: string } } }>({
      defaults: { box: { style: { color: 'red', margin: '0' } } },
    })

    expect(local.layout(local.node('box', { props: { style: { margin: '4px' } } }), 's').props).toEqual({
      style: { color: 'red', margin: '4px' },
    })
  })

  it('do not mutate the defaults', () => {
    props(node('card', { props: { size: 'large' } }))

    expect(props(node('card')).size).toBe('medium')
  })

  it('trace: a prop the block sets is "template", one it doesn\'t is "default" — even with the same value', () => {
    const traced = ui.layout(node('card', { props: { size: 'medium' } }), 's', { trace: true })

    expect(traced.trace).toEqual({ size: { from: 'template' }, variant: { from: 'default' }, testId: { from: 'default' } })
  })

  it('carries slots over', () => {
    const media = node('image')

    expect(node('profile', { props: { size: 'small' }, slots: { cover: media } })).toEqual({
      component: 'profile',
      props: { size: 'small' },
      slots: { cover: media },
    })
  })

  it('carries over the remaining block fields', () => {
    const child = node('card')

    expect(
      node('stack', {
        props: { gap: 'medium' },
        repeat: 2,
        alias: 'main',
        children: [child],
      })
    ).toEqual({
      component: 'stack',
      props: { gap: 'medium' },
      repeat: 2,
      alias: 'main',
      children: [child],
    })
  })
})

describe('repeat', () => {
  it('returns a copy with repeat set', () => {
    const card = node('card')
    const repeated = repeat(card, 3)

    expect(repeated).toEqual({ ...card, repeat: 3 })
    expect(card.repeat).toBeUndefined()
  })

  it.each([0, -1, 1.5, NaN])('rejects count = %s', count => {
    expect(() => repeat(node('card'), count)).toThrow(RangeError)
  })
})

describe('clone', () => {
  it('repeats a sequence of blocks', () => {
    const a = node('card')
    const b = node('heading')

    expect(clone(2, a, b)).toEqual([a, b, a, b])
  })

  it('rejects count < 1', () => {
    expect(() => clone(0, node('card'))).toThrow(RangeError)
  })
})
