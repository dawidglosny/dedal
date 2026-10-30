import { describe, expect, it } from 'vitest'
import { assign, createDedal } from '../src'
import type { TestComponents } from './fixtures'
import { node, repeat, ui } from './fixtures'

/*
 * n               grid
 * ├ n.0           heading
 * ├ n.1           card #hero
 * ├ n.2..n.4      card ×3
 * └ n.5           stack
 *   └ n.5.0       profile
 *     └ n.5.0:cover   image
 */
const build = () =>
  ui.layout(
    node('grid', {
      children: [
        node('heading'),
        node('card', { alias: 'hero' }),
        repeat(node('card'), 3),
        node('stack', {
          children: [node('profile', { slots: { cover: node('image') } })],
        }),
      ],
    }),
    'n'
  )

const ids = (root: { id: string; children?: { id: string }[] } | null) => root?.children?.map(child => child.id)

describe('assign', () => {
  it('assigns data in order, following tree order', () => {
    const { data } = ui.assign(build(), {
      'heading': [{ title: 'Latest' }],
      card: ['a', 'b', 'c', 'd'],
    })

    expect(data).toEqual({ 'n.0': { title: 'Latest' }, 'n.1': 'a', 'n.2': 'b', 'n.3': 'c', 'n.4': 'd' })
  })

  it('an earlier selector claims nodes, later ones skip them', () => {
    const { data } = ui.assign(build(), { '#hero': ['hero'], card: ['a', 'b', 'c'] })

    expect(data).toEqual({ 'n.1': 'hero', 'n.2': 'a', 'n.3': 'b', 'n.4': 'c' })
  })

  it('a claimed node without data is not filled by later selectors', () => {
    const { data, layout } = ui.assign(build(), { '#hero': [], card: ['a', 'b', 'c', 'd'] })

    expect(data).toEqual({ 'n.2': 'a', 'n.3': 'b', 'n.4': 'c' })
    expect(ids(layout)).not.toContain('n.1')
  })

  it('assigns data to slot contents', () => {
    const { data } = ui.assign(build(), {
      'profile': [{ name: 'Jan' }],
      'profile > :slot(cover)': [{ src: 'bg.webp' }],
    })

    expect(data).toEqual({ 'n.5.0': { name: 'Jan' }, 'n.5.0:cover': { src: 'bg.webp' } })
  })

  it('the result is plain JSON', () => {
    const result = ui.assign(build(), { card: [{ title: 'a' }] })

    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})

describe('onShortage', () => {
  it("'remove' by default: removes nodes without data", () => {
    const { layout, report } = ui.assign(build(), { card: ['a', 'b'] })

    expect(ids(layout)).toEqual(['n.0', 'n.1', 'n.2', 'n.5'])
    expect(report.removed).toEqual(['n.3', 'n.4'])
  })

  it("'keep': keeps nodes without data", () => {
    const root = build()
    const { layout, data, report } = ui.assign(root, { card: ['a'] }, { onShortage: 'keep' })

    expect(layout).toBe(root)
    expect(data).toEqual({ 'n.1': 'a' })
    expect(report.bindings[0].missing).toEqual(['n.2', 'n.3', 'n.4'])
    expect(report.removed).toEqual([])
  })

  it("'error': throws an error listing all shortages", () => {
    expect(() => ui.assign(build(), { card: ['a'], 'heading': [] }, { onShortage: 'error' })).toThrow(
      /"card": missing data for 3 node\(s\) \(n\.2, n\.3, n\.4\)[\s\S]*"heading": missing data for 1 node\(s\)/
    )
  })

  it('null and undefined in data mean no data for the node', () => {
    const { layout, data } = ui.assign(build(), { card: ['a', null, undefined, 'd'] })

    expect(data).toEqual({ 'n.1': 'a', 'n.4': 'd' })
    expect(ids(layout)).toEqual(['n.0', 'n.1', 'n.4', 'n.5'])
  })

  it('a per-selector policy overrides the call policy', () => {
    const { layout } = ui.assign(
      build(),
      { 'heading': { items: [], onShortage: 'keep' }, card: ['a'] },
      { onShortage: 'remove' }
    )

    expect(ids(layout)).toEqual(['n.0', 'n.1', 'n.5'])
  })

  it('instance default policy, overridable per call', () => {
    const keeping = createDedal<TestComponents>({ assign: { onShortage: 'keep' } })
    const root = build()

    expect(keeping.assign(root, { card: [] }).layout).toBe(root)
    expect(ids(keeping.assign(root, { card: [] }, { onShortage: 'remove' }).layout)).toEqual(['n.0', 'n.5'])
    expect(keeping.assign(root, { card: [] }, { onShortage: undefined }).layout).toBe(root)
  })

  it('removing an ancestor drops the data of its descendants', () => {
    const { layout, data, report } = ui.assign(build(), {
      'stack': [],
      'profile': [{ name: 'Jan' }],
    })

    expect(ids(layout)).not.toContain('n.5')
    expect(data).toEqual({})
    expect(report.dropped).toEqual(['n.5.0'])
  })

  it('removing the root yields a null layout', () => {
    const { layout, data } = ui.assign(build(), { 'grid': [], card: ['a'] })

    expect(layout).toBeNull()
    expect(data).toEqual({})
  })
})

describe('onSurplus', () => {
  it("'ignore' by default: reports surplus data", () => {
    const { report } = ui.assign(build(), { 'heading': ['a', 'b', 'c'] })

    expect(report.bindings[0]).toMatchObject({ matched: 1, assigned: 1, unused: 2 })
  })

  it("'error': throws an error", () => {
    expect(() => ui.assign(build(), { 'heading': ['a', 'b'] }, { onSurplus: 'error' })).toThrow(
      '"heading": 1 data item(s) without a node'
    )
  })
})

describe('report and input', () => {
  it('reports every selector', () => {
    const { report } = ui.assign(build(), { '#hero': ['h'], card: ['a'], '#missing': ['x'] }, {}, { trace: true })

    expect(report.bindings).toEqual([
      { selector: '#hero', nodes: ['n.1'], received: 1, matched: 1, assigned: 1, missing: [], unused: 0, onShortage: 'remove' },
      { selector: 'card', nodes: ['n.2', 'n.3', 'n.4'], received: 1, matched: 3, assigned: 1, missing: ['n.3', 'n.4'], unused: 0, onShortage: 'remove' },
      {
        selector: '#missing',
        nodes: [],
        received: 1,
        matched: 0,
        assigned: 0,
        missing: [],
        unused: 1,
        unusedItems: [{ index: 0, preview: '"x"' }],
        onShortage: 'remove',
      },
    ])
  })

  it('trace: lost data with index and value preview', () => {
    const long = { title: 'x'.repeat(200) }
    const { report } = ui.assign(build(), { card: ['a', 'b', 'c', 'd', { id: 7 }, long] }, {}, { trace: true })

    expect(report.bindings[0].unusedItems).toEqual([
      { index: 4, preview: '{"id":7}' },
      { index: 5, preview: `${JSON.stringify(long).slice(0, 79)}…` },
    ])
  })

  it('without trace the report has no node list or lost data (JSON unchanged)', () => {
    const { report } = ui.assign(build(), { card: ['a', 'b', 'c', 'd', 'e'] })

    expect(report.bindings[0]).not.toHaveProperty('nodes')
    expect(report.bindings[0]).not.toHaveProperty('unusedItems')
    expect(report.bindings[0]).not.toHaveProperty('received')
    expect(report.bindings[0].unused).toBe(1)
  })

  it('does not mutate the input layout or data', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))
    const items = Object.freeze(['a'])

    assign(root, { card: items })

    expect(root).toEqual(snapshot)
  })

  it('rejects data that is not an array', () => {
    expect(() => ui.assign(build(), { card: 'a' as never })).toThrow(TypeError)
    expect(() => ui.assign(build(), { card: { items: 'a' } as never })).toThrow(TypeError)
  })

  it('propagates a selector syntax error', () => {
    expect(() => ui.assign(build(), { 'card >': [] })).toThrow(SyntaxError)
  })
})

describe('lost data preview', () => {
  it('object: first 3 primitive fields, no nesting; array: item count', () => {
    const article = { id: 7, author: { name: 'A' }, headline: 'Title', tags: ['x'], excerpt: 'Lead', url: '/a' }
    const { report } = ui.assign(build(), { card: ['a', 'b', 'c', 'd', article, [1, 2, 3]] }, {}, { trace: true })

    expect(report.bindings[0].unusedItems).toEqual([
      { index: 4, preview: '{"id":7,"headline":"Title","excerpt":"Lead"}' },
      { index: 5, preview: '[3 el.]' },
    ])
  })
})
