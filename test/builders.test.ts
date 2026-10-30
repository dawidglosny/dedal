import { describe, expect, it } from 'vitest'
import { createDedal } from '../src'
import { clone, node, repeat } from './fixtures'

describe('node', () => {
  it('applies default props', () => {
    expect(node('card')).toEqual({
      component: 'card',
      props: { size: 'medium', variant: 'vertical', testId: 'article' },
    })
  })

  it('passed props win over defaults', () => {
    expect(node('card', { props: { size: 'small' } }).props).toEqual({
      size: 'small',
      variant: 'vertical',
      testId: 'article',
    })
  })

  it('always sets props, even without defaults', () => {
    expect(node('grid')).toEqual({ component: 'grid', props: {} })
  })

  it('an array replaces the default instead of being appended to it', () => {
    const sources = [{ minWidth: 990, size: 'lg' }]

    expect(node('image', { props: { sources } }).props?.sources).toEqual(sources)
  })

  it('undefined overrides the default value', () => {
    const props = node('image', { props: { sources: undefined } }).props!

    expect('sources' in props).toBe(true)
    expect(props.sources).toBeUndefined()
  })

  it('objects are deep-merged', () => {
    const { node } = createDedal<{ box: { style?: { color?: string; margin?: string } } }>({
      defaults: { box: { style: { color: 'red', margin: '0' } } },
    })

    expect(node('box', { props: { style: { margin: '4px' } } }).props).toEqual({
      style: { color: 'red', margin: '4px' },
    })
  })

  it('does not mutate default props', () => {
    node('card', { props: { size: 'large' } })

    expect(node('card').props?.size).toBe('medium')
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
