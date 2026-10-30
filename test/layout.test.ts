import { describe, expect, it } from 'vitest'
import { layout } from '../src'
import { node, repeat } from './fixtures'

describe('layout', () => {
  it('assigns IDs by position and expands repeat into siblings', () => {
    const root = layout(
      node('grid', {
        children: [node('heading'), repeat(node('card'), 2), node('stack')],
      }),
      'news'
    )

    expect(root.id).toBe('news')
    expect(root.children!.map(child => [child.id, child.component])).toEqual([
      ['news.0', 'heading'],
      ['news.1', 'card'],
      ['news.2', 'card'],
      ['news.3', 'stack'],
    ])
  })

  it('assigns IDs recursively', () => {
    const root = layout(
      node('container', {
        children: [node('grid', { children: [node('card'), node('card')] })],
      }),
      's'
    )

    expect(root.children![0].children!.map(child => child.id)).toEqual(['s.0.0', 's.0.1'])
  })

  it('copies block fields and normalizes props', () => {
    const root = layout(
      node('stack', {
        alias: 'main',
      }),
      's'
    )

    expect(root).toEqual({
      id: 's',
      component: 'stack',
      props: {},
      alias: 'main',
    })
  })

  it('omits empty children and unset fields', () => {
    expect(layout({ component: 'card' }, 's')).toEqual({ id: 's', component: 'card', props: {} })
  })

  it('repeat instances have separate props objects', () => {
    const root = layout(node('grid', { children: [repeat(node('card'), 2)] }), 's')

    expect(root.children![0].props).not.toBe(root.children![1].props)
  })

  it('does not mutate the input block', () => {
    const block = node('grid', { children: [repeat(node('card'), 3)] })
    const snapshot = JSON.parse(JSON.stringify(block))

    layout(block, 's')

    expect(block).toEqual(snapshot)
  })

  it('accepts a custom ID generator', () => {
    const root = layout(
      node('grid', { children: [node('card', { alias: 'hero' }), node('card')] }),
      'news',
      { id: ({ prefix, path, component, alias }) => [prefix, ...path, alias ?? component].join('/') }
    )

    expect([root.id, ...root.children!.map(child => child.id)]).toEqual(['news/grid', 'news/0/hero', 'news/1/card'])
  })

  it('rejects duplicate IDs from a custom generator', () => {
    const block = node('grid', { children: [node('card'), node('card')] })

    expect(() => layout(block, 's', { id: ({ component }) => component })).toThrow('duplicate ID "card"')
  })

  it('rejects repeat on the root', () => {
    expect(() => layout({ component: 'card', repeat: 2 }, 's')).toThrow(RangeError)
  })

  it.each([0, -1, 1.5])('rejects invalid repeat = %s', count => {
    expect(() => layout(node('grid', { children: [{ component: 'card', repeat: count }] }), 's')).toThrow(
      RangeError
    )
  })
})
