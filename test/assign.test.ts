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
  it('przypisuje dane po kolei, w kolejności drzewa', () => {
    const { data } = ui.assign(build(), {
      'heading': [{ title: 'Najnowsze' }],
      card: ['a', 'b', 'c', 'd'],
    })

    expect(data).toEqual({ 'n.0': { title: 'Najnowsze' }, 'n.1': 'a', 'n.2': 'b', 'n.3': 'c', 'n.4': 'd' })
  })

  it('wcześniejszy selektor zajmuje węzły, kolejne je pomijają', () => {
    const { data } = ui.assign(build(), { '#hero': ['hero'], card: ['a', 'b', 'c'] })

    expect(data).toEqual({ 'n.1': 'hero', 'n.2': 'a', 'n.3': 'b', 'n.4': 'c' })
  })

  it('węzeł zajęty, ale bez danych nie jest dopełniany przez kolejne selektory', () => {
    const { data, layout } = ui.assign(build(), { '#hero': [], card: ['a', 'b', 'c', 'd'] })

    expect(data).toEqual({ 'n.2': 'a', 'n.3': 'b', 'n.4': 'c' })
    expect(ids(layout)).not.toContain('n.1')
  })

  it('przypisuje dane do zawartości slotów', () => {
    const { data } = ui.assign(build(), {
      'profile': [{ name: 'Jan' }],
      'profile > :slot(cover)': [{ src: 'bg.webp' }],
    })

    expect(data).toEqual({ 'n.5.0': { name: 'Jan' }, 'n.5.0:cover': { src: 'bg.webp' } })
  })

  it('wynik jest czystym JSON-em', () => {
    const result = ui.assign(build(), { card: [{ title: 'a' }] })

    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})

describe('onShortage', () => {
  it("domyślnie 'remove': usuwa węzły bez danych", () => {
    const { layout, report } = ui.assign(build(), { card: ['a', 'b'] })

    expect(ids(layout)).toEqual(['n.0', 'n.1', 'n.2', 'n.5'])
    expect(report.removed).toEqual(['n.3', 'n.4'])
  })

  it("'keep': zostawia węzły bez danych", () => {
    const root = build()
    const { layout, data, report } = ui.assign(root, { card: ['a'] }, { onShortage: 'keep' })

    expect(layout).toBe(root)
    expect(data).toEqual({ 'n.1': 'a' })
    expect(report.bindings[0].missing).toEqual(['n.2', 'n.3', 'n.4'])
    expect(report.removed).toEqual([])
  })

  it("'error': rzuca błąd z listą wszystkich braków", () => {
    expect(() => ui.assign(build(), { card: ['a'], 'heading': [] }, { onShortage: 'error' })).toThrow(
      /"card": missing data for 3 node\(s\) \(n\.2, n\.3, n\.4\)[\s\S]*"heading": missing data for 1 node\(s\)/
    )
  })

  it('null i undefined w danych to brak danych dla węzła', () => {
    const { layout, data } = ui.assign(build(), { card: ['a', null, undefined, 'd'] })

    expect(data).toEqual({ 'n.1': 'a', 'n.4': 'd' })
    expect(ids(layout)).toEqual(['n.0', 'n.1', 'n.4', 'n.5'])
  })

  it('zasada pojedynczego selektora nadpisuje zasadę wywołania', () => {
    const { layout } = ui.assign(
      build(),
      { 'heading': { items: [], onShortage: 'keep' }, card: ['a'] },
      { onShortage: 'remove' }
    )

    expect(ids(layout)).toEqual(['n.0', 'n.1', 'n.5'])
  })

  it('domyślna zasada instancji, nadpisywalna w wywołaniu', () => {
    const keeping = createDedal<TestComponents>({ assign: { onShortage: 'keep' } })
    const root = build()

    expect(keeping.assign(root, { card: [] }).layout).toBe(root)
    expect(ids(keeping.assign(root, { card: [] }, { onShortage: 'remove' }).layout)).toEqual(['n.0', 'n.5'])
    expect(keeping.assign(root, { card: [] }, { onShortage: undefined }).layout).toBe(root)
  })

  it('usunięcie przodka odrzuca dane potomków', () => {
    const { layout, data, report } = ui.assign(build(), {
      'stack': [],
      'profile': [{ name: 'Jan' }],
    })

    expect(ids(layout)).not.toContain('n.5')
    expect(data).toEqual({})
    expect(report.dropped).toEqual(['n.5.0'])
  })

  it('usunięcie korzenia daje layout null', () => {
    const { layout, data } = ui.assign(build(), { 'grid': [], card: ['a'] })

    expect(layout).toBeNull()
    expect(data).toEqual({})
  })
})

describe('onSurplus', () => {
  it("domyślnie 'ignore': raportuje nadmiarowe dane", () => {
    const { report } = ui.assign(build(), { 'heading': ['a', 'b', 'c'] })

    expect(report.bindings[0]).toMatchObject({ matched: 1, assigned: 1, unused: 2 })
  })

  it("'error': rzuca błąd", () => {
    expect(() => ui.assign(build(), { 'heading': ['a', 'b'] }, { onSurplus: 'error' })).toThrow(
      '"heading": 1 data item(s) without a node'
    )
  })
})

describe('raport i wejście', () => {
  it('raportuje każdy selektor', () => {
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

  it('trace: utracone dane z indeksem i skrótem wartości', () => {
    const long = { title: 'x'.repeat(200) }
    const { report } = ui.assign(build(), { card: ['a', 'b', 'c', 'd', { id: 7 }, long] }, {}, { trace: true })

    expect(report.bindings[0].unusedItems).toEqual([
      { index: 4, preview: '{"id":7}' },
      { index: 5, preview: `${JSON.stringify(long).slice(0, 79)}…` },
    ])
  })

  it('bez trace raport nie ma listy węzłów ani utraconych danych (JSON bez zmian)', () => {
    const { report } = ui.assign(build(), { card: ['a', 'b', 'c', 'd', 'e'] })

    expect(report.bindings[0]).not.toHaveProperty('nodes')
    expect(report.bindings[0]).not.toHaveProperty('unusedItems')
    expect(report.bindings[0]).not.toHaveProperty('received')
    expect(report.bindings[0].unused).toBe(1)
  })

  it('nie mutuje layoutu ani danych wejściowych', () => {
    const root = build()
    const snapshot = JSON.parse(JSON.stringify(root))
    const items = Object.freeze(['a'])

    assign(root, { card: items })

    expect(root).toEqual(snapshot)
  })

  it('odrzuca dane, które nie są tablicą', () => {
    expect(() => ui.assign(build(), { card: 'a' as never })).toThrow(TypeError)
    expect(() => ui.assign(build(), { card: { items: 'a' } as never })).toThrow(TypeError)
  })

  it('przepuszcza błąd składni selektora', () => {
    expect(() => ui.assign(build(), { 'card >': [] })).toThrow(SyntaxError)
  })
})

describe('skrót utraconych danych', () => {
  it('obiekt: pierwsze 3 proste pola, bez zagnieżdżeń; tablica: liczba elementów', () => {
    const article = { id: 7, author: { name: 'A' }, headline: 'Tytuł', tags: ['x'], excerpt: 'Lead', url: '/a' }
    const { report } = ui.assign(build(), { card: ['a', 'b', 'c', 'd', article, [1, 2, 3]] }, {}, { trace: true })

    expect(report.bindings[0].unusedItems).toEqual([
      { index: 4, preview: '{"id":7,"headline":"Tytuł","excerpt":"Lead"}' },
      { index: 5, preview: '[3 el.]' },
    ])
  })
})
