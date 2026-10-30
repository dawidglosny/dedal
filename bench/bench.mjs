// Benchmark of engine stages on a near-realistic page. Each section: container > heading + grid > hero (#hero, media slot)
// + N × card (media slot, footer list slot with 2 badges); a remove, 4 patches, 3 bindings (2 cards without data) and
// resolve with toProps for card. Measure before / after every optimisation (docs/ROADMAP.md).
// Run: npm run bench (builds dist and measures the built package).
import { assign, createDedal, layout, patch, remove, resolveTree, section, select } from '../dist/index.js'

const ui = createDedal({
  defaults: { card: { size: 'md', loading: 'lazy' } },
  toProps: {
    card: ({ props, data }) => (data ? { ...props, title: data.title, href: data.url, image: data.image } : props),
  },
})
const { node, repeat } = ui

const REMOVE = 'card:nth-child(n+40) badge'
const PATCH = {
  'grid > card:nth-child(odd)': { size: 'lg' },
  'card :slot(media)': { ratio: '16:9' },
  '#hero image': { priority: true },
  'container card badge:last-child': { tone: 'muted' },
}

const block = cards =>
  node('container', {
    props: { size: 'lg' },
    children: [
      node('heading', { props: { level: 2 } }),
      node('grid', {
        props: { columns: 3 },
        children: [
          node('hero', { alias: 'hero', slots: { media: node('image') } }),
          repeat(node('card', { slots: { media: node('image'), footer: [node('badge'), node('badge')] } }), cards),
        ],
      }),
    ],
  })

const article = i => ({ title: `Tytuł ${i}`, url: `/a/${i}`, image: { src: `/img/${i}.jpg`, alt: 'x' }, tags: ['a', 'b'] })

const bindings = cards => ({
  '#hero': [article(0)],
  heading: [{ title: 'Sekcja' }],
  card: Array.from({ length: cards - 2 }, (_, i) => article(i)), // 2 cards without data → onShortage: 'remove'
})

const makePage = (sectionCount, cards) =>
  ui.page({
    sections: () =>
      Array.from({ length: sectionCount }, (_, s) => section(`s${s}`, block(cards), { remove: REMOVE, patch: PATCH })),
    data: () => Object.fromEntries(Array.from({ length: sectionCount }, (_, s) => [`s${s}`, bindings(cards)])),
  })

const row = (label, value) => console.log(`${label.padEnd(36)} ${value}`)

const time = (label, fn, iterations) => {
  for (let i = 0; i < Math.min(iterations, 20); i++) fn()
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  row(label, `${((performance.now() - start) / iterations).toFixed(3)} ms`)
}

const timeAsync = async (label, fn, iterations) => {
  for (let i = 0; i < Math.min(iterations, 20); i++) await fn()
  const start = performance.now()
  for (let i = 0; i < iterations; i++) await fn()
  row(label, `${((performance.now() - start) / iterations).toFixed(3)} ms`)
}

for (const [sectionCount, cards] of [
  [10, 12],
  [20, 50],
]) {
  const page = makePage(sectionCount, cards)
  const { sections } = page.layout()
  const nodes = sections.reduce((count, { layout: root }) => count + select(root, '*').length, 0)
  const data = await page.load()
  const result = page.assign(sections, data)
  const iterations = nodes > 3000 ? 100 : 500

  console.log(`\n== ${sectionCount} sekcji × ${cards} kart → ${nodes} węzłów ==`)
  time('page.layout (layout+remove+patch)', () => page.layout(), iterations)
  time('page.assign', () => page.assign(sections, data), iterations)
  time('resolve', () => ui.resolve(result), iterations)
  time('resolve trace', () => ui.resolve(result, { trace: true }), iterations)
  await timeAsync('build + resolve (pełny request)', async () => ui.resolve(await page.build()), iterations)
  row('JSON PageResult', `${(JSON.stringify(result).length / 1024).toFixed(0)} KB`)

  const sectionBlock = block(cards)
  const sectionLayout = layout(sectionBlock, 's0')
  time('  layout() 1 sekcja', () => layout(sectionBlock, 's0'), iterations * 5)
  time('  remove() 1 sekcja', () => remove(sectionLayout, REMOVE), iterations * 5)
  time('  patch() 1 sekcja (4 selektory)', () => patch(sectionLayout, PATCH), iterations * 5)
  time('  assign() 1 sekcja', () => assign(sectionLayout, data.s0), iterations * 5)
  time('  resolveTree() 1 sekcja', () => resolveTree(sectionLayout, {}), iterations * 5)
}

// unique selectors (e.g. composed from data) must not grow the process without bound
const single = layout(node('card'), 'x')
globalThis.gc?.()
const heapBefore = process.memoryUsage().heapUsed
for (let i = 0; i < 200_000; i++) select(single, `card[slug=a${i}]`)
globalThis.gc?.()
console.log()
row('200k unikalnych selektorów', `heap +${((process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024).toFixed(1)} MB`)
