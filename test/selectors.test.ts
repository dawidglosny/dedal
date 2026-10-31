import { describe, expect, it } from 'vitest'
import { parseSelector, select } from '../src'
import { node, repeat, ui } from './fixtures'

/*
 * s                 container #page
 * ├ s.0             grid [columns=2]
 * │ ├ s.0.0         heading [size=large]
 * │ ├ s.0.1..s.0.4  card ×4 (s.0.2 has #hero)
 * │ └ s.0.5         stack
 * │   └ s.0.5.0     card [size=small]
 * └ s.1             grid
 *   └ s.1.0         card [style.height=100%]
 */
const root = ui.layout(
  node('container', {
    alias: 'page',
    children: [
      node('grid', {
        props: { columns: 2 },
        children: [
          node('heading', { props: { size: 'large' } }),
          node('card'),
          node('card', { alias: 'hero' }),
          repeat(node('card'), 2),
          node('stack', { children: [node('card', { props: { size: 'small' } })] }),
        ],
      }),
      node('grid', {
        children: [{ component: 'card', props: { style: { height: '100%' } } as never }],
      }),
    ],
  }),
  's'
)

const ids = (selector: string) => select(root, selector).map(n => n.id)

describe('matching', () => {
  it.each([
    ['card', ['s.0.1', 's.0.2', 's.0.3', 's.0.4', 's.0.5.0', 's.1.0']],
    ['*', ['s', 's.0', 's.0.0', 's.0.1', 's.0.2', 's.0.3', 's.0.4', 's.0.5', 's.0.5.0', 's.1', 's.1.0']],
    ['#hero', ['s.0.2']],
    ['card#hero', ['s.0.2']],
    ['heading#hero', []],
    ['[columns]', ['s.0']],
    ['[columns=2]', ['s.0']],
    ['card[size=small]', ['s.0.5.0']],
    ['[style.height="100%"]', ['s.1.0']],
    // s.1.0 is a plain object, not node() — it gets the defaults too, like a template parsed from JSON
    ['card[size="medium"]', ['s.0.1', 's.0.2', 's.0.3', 's.0.4', 's.1.0']],
  ])('%s', (selector, expected) => {
    expect(ids(selector)).toEqual(expected)
  })

  it.each([
    ['grid > :first-child', ['s.0.0', 's.1.0']],
    ['grid > :last-child', ['s.0.5', 's.1.0']],
    ['card:nth-child(2)', ['s.0.1']],
    ['grid > card:nth-child(odd)', ['s.0.2', 's.0.4', 's.1.0']],
    ['grid > *:nth-child(2n)', ['s.0.1', 's.0.3', 's.0.5']],
    ['grid > *:nth-child(n+5)', ['s.0.4', 's.0.5']],
    ['grid > *:nth-child(-n+2)', ['s.0.0', 's.0.1', 's.1.0']],
    ['grid > :nth-last-child(2)', ['s.0.4']],
  ])('position: %s', (selector, expected) => {
    expect(ids(selector)).toEqual(expected)
  })

  it.each([
    ['grid card', ['s.0.1', 's.0.2', 's.0.3', 's.0.4', 's.0.5.0', 's.1.0']],
    ['grid > card', ['s.0.1', 's.0.2', 's.0.3', 's.0.4', 's.1.0']],
    ['stack card', ['s.0.5.0']],
    ['#page grid:first-child card:last-child', ['s.0.5.0']],
    ['#page > grid > stack > card', ['s.0.5.0']],
    ['container > card', []],
    ['grid[columns=2] > card', ['s.0.1', 's.0.2', 's.0.3', 's.0.4']],
  ])('combinators: %s', (selector, expected) => {
    expect(ids(selector)).toEqual(expected)
  })

  it('a selector list returns nodes in tree order, without duplicates', () => {
    expect(ids('stack card, heading, #hero')).toEqual(['s.0.0', 's.0.2', 's.0.5.0'])
  })

  it('descendant with backtracking over ancestors', () => {
    // the nearest grid ancestor doesn't have columns=2, only a farther one matches
    const nested = ui.layout(
      node('grid', {
        props: { columns: 2 },
        children: [node('grid', { children: [node('card')] })],
      }),
      'n'
    )

    expect(select(nested, 'grid[columns=2] card').map(n => n.id)).toEqual(['n.0.0'])
    expect(select(nested, 'grid[columns=2] > card')).toEqual([])
  })

  it('the ancestor position is checked', () => {
    expect(ids('grid:first-child stack card')).toEqual(['s.0.5.0'])
    expect(ids('grid:last-child stack card')).toEqual([])
  })
})

describe(':root', () => {
  it('matches only the tree root', () => {
    const nested = ui.layout(node('grid', { children: [node('grid', { children: [node('card')] }), node('card')] }), 'r')

    expect(select(nested, 'grid').map(({ id }) => id)).toEqual(['r', 'r.0'])
    expect(select(nested, 'grid:root').map(({ id }) => id)).toEqual(['r'])
    expect(select(nested, ':root > card').map(({ id }) => id)).toEqual(['r.1'])
  })
})

describe('parseSelector', () => {
  it('ignores whitespace around combinators and commas', () => {
    expect(parseSelector('  a>b ,  c   d ')).toEqual(parseSelector('a > b, c d'))
  })

  it('caches the result', () => {
    expect(parseSelector('card > heading')).toBe(parseSelector('card > heading'))
  })

  it('the cache is bounded — evicts the least recently used selectors, frequently used ones stay', () => {
    const hot = parseSelector('grid > card:first-child')
    const cold = parseSelector('card[slug=cold]')

    for (let i = 0; i < 2000; i++) {
      parseSelector(`card[slug=a${i}]`)
      if (i % 100 === 0) parseSelector('grid > card:first-child')
    }

    expect(parseSelector('grid > card:first-child')).toBe(hot)
    expect(parseSelector('card[slug=cold]')).not.toBe(cold)
    expect(parseSelector('card[slug=cold]')).toEqual(cold)
  })

  it.each(['', 'card >', '> card', 'card,', '#', '[size', '[size=]', 'card:hover', ':nth-child(x)', 'card..x', '[a="b]'])(
    'rejects "%s"',
    selector => {
      expect(() => parseSelector(selector)).toThrow(SyntaxError)
    }
  )
})
