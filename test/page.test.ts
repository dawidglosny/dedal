import { describe, expect, it, vi } from 'vitest'
import { createDedal, WIRE_VERSION, type LayoutNode } from '../src'

/** Contract of the test category page (mock). */
type Contract = {
  'container': { tone?: string | null; paddingTop?: boolean }
  'grid': { columns?: number }
  'stack': { gap?: string }
  breadcrumbs: { items?: string[] }
  'page-title': { headerTag?: 'h1' | 'h2'; title?: string }
  card: { size?: 'small' | 'medium'; variant?: 'vertical' | 'horizontal'; preload?: boolean; loading?: 'eager' | 'lazy' }
  divider: Record<string, never>
  banner: { slot?: string }
  pagination: { page?: number }
  'description': { text?: string }
}

type Ctx = { device: 'desktop' | 'mobile'; page: number }

const ui = createDedal<Contract>()
const { node, repeat, section } = ui

// --- blocks
const breadcrumbsBlock = node('container', { children: [node('breadcrumbs')] })
const titleBlock = node('container', { children: [node('page-title')] })
const cardGrid9 = node('container', {
  children: [node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 9)] })],
})
const cardListMobile = node('container', {
  children: [
    node('stack', {
      children: [node('card'), node('divider'), node('card'), node('divider'), node('card')],
    }),
  ],
})
const promoBlock = node('container', { children: [node('banner')] })
const paginationBlock = node('container', { children: [node('pagination')] })
const aboutBlock = node('container', {
  props: { tone: 'muted' },
  children: [node('description')],
})

// --- page: one definition for desktop and mobile
const loader = vi.fn(async (ctx: Ctx) => {
  const articles = Array.from({ length: ctx.device === 'desktop' ? 12 : 4 }, (_, i) => ({ title: `Article ${i}` }))

  return {
    breadcrumbs: { breadcrumbs: [{ items: ['Shop', 'Category'] }] },
    pageHeader: { 'page-title': [{ title: 'Category' }] },
    mainContent: { card: articles },
    pagination: { pagination: [{ page: ctx.page }] },
  }
})

const categoryPage = ui.page<Ctx>({
  sections: ({ device }) => [
    section('breadcrumbs', breadcrumbsBlock),
    section('pageHeader', titleBlock, {
      patch: { 'page-title': { headerTag: 'h1' }, 'container': { paddingTop: false } },
    }),
    device === 'desktop'
      ? section('mainContent', cardGrid9, { patch: { card: { preload: true, loading: 'eager' } } })
      : section('mainContent', cardListMobile, {
          remove: 'divider',
          patch: {
            card: { preload: true, loading: 'eager', variant: 'vertical', size: 'small' },
            'stack': { gap: 'large' },
          },
        }),
    section('promo', promoBlock),
    section('pagination', paginationBlock),
    section('about', aboutBlock, { patch: { 'container': { tone: null } } }),
  ],
  data: loader,
})

const sectionOf = (result: { sections: { key: string; layout: LayoutNode<Contract> }[] }, key: string) =>
  result.sections.find(s => s.key === key)!.layout

const cards = (root: LayoutNode<Contract>) => ui.select(root, 'card')

describe('page: category page', () => {
  it('desktop: sections in order, IDs prefixed with the section, patches and data', async () => {
    const result = await categoryPage.build({ device: 'desktop', page: 1 })

    expect(result.dedal).toBe(WIRE_VERSION)
    expect(result.sections.map(s => s.key)).toEqual([
      'breadcrumbs',
      'pageHeader',
      'mainContent',
      'promo',
      'pagination',
      'about',
    ])

    const main = sectionOf(result, 'mainContent')
    expect(cards(main).map(card => card.id)).toEqual(Array.from({ length: 9 }, (_, i) => `mainContent.0.${i}`))
    expect(cards(main).every(card => card.props.preload === true && card.props.loading === 'eager')).toBe(true)

    expect(result.data['mainContent.0.0']).toEqual({ title: 'Article 0' })
    expect(result.data['pageHeader.0']).toEqual({ title: 'Category' })
    expect(result.data['pagination.0']).toEqual({ page: 1 })
    expect(result.report.sections.mainContent.bindings[0]).toMatchObject({ matched: 9, assigned: 9, unused: 3 })

    expect(sectionOf(result, 'pageHeader').props).toEqual({ paddingTop: false })
    expect(ui.select(sectionOf(result, 'pageHeader'), 'page-title')[0].props).toEqual({ headerTag: 'h1' })
    expect(sectionOf(result, 'about').props).toEqual({ tone: null })
  })

  it('mobile: remove runs before patch, surplus data goes to the report', async () => {
    const result = await categoryPage.build({ device: 'mobile', page: 2 })
    const main = sectionOf(result, 'mainContent')

    expect(ui.select(main, 'divider')).toEqual([])
    expect(cards(main).map(card => card.props)).toEqual(
      Array(3).fill({ preload: true, loading: 'eager', variant: 'vertical', size: 'small' })
    )
    expect(ui.select(main, 'stack')[0].props).toEqual({ gap: 'large' })
    expect(result.data['pagination.0']).toEqual({ page: 2 })
    expect(result.report.sections.mainContent.bindings[0]).toMatchObject({ matched: 3, assigned: 3, unused: 1 })
  })

  it('sections without data stay unchanged and unreported', async () => {
    const result = await categoryPage.build({ device: 'desktop', page: 1 })

    expect(sectionOf(result, 'promo').children![0].component).toBe('banner')
    expect(result.report.sections.promo).toBeUndefined()
  })

  it('the result is plain JSON', async () => {
    const result = await categoryPage.build({ device: 'mobile', page: 1 })

    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})

describe('page: separate stages', () => {
  it('layout() does not call the loader and gives the same layout as build() without data', async () => {
    loader.mockClear()
    const { sections } = await categoryPage.layout({ device: 'desktop', page: 1 })

    expect(loader).not.toHaveBeenCalled()
    expect(sections).toHaveLength(6)
    expect(cards(sections.find(s => s.key === 'mainContent')!.layout)).toHaveLength(9)
  })

  it('layout → load → assign gives the same as build()', async () => {
    const ctx: Ctx = { device: 'mobile', page: 3 }
    const { sections } = await categoryPage.layout(ctx)
    const staged = await categoryPage.assign(sections, await categoryPage.load(ctx), ctx)

    expect(staged).toEqual(await categoryPage.build(ctx))
  })

  it('passing the layout through JSON (e.g. cache or network) does not affect the result', async () => {
    const ctx: Ctx = { device: 'desktop', page: 1 }
    const cached = JSON.parse(JSON.stringify((await categoryPage.layout(ctx)).sections))

    expect(await categoryPage.assign(cached, await categoryPage.load(ctx), ctx)).toEqual(await categoryPage.build(ctx))
  })
})

describe('page: policies and errors', () => {
  it('section policies override instance policies', async () => {
    const keeping = createDedal<Contract>({ assign: { onShortage: 'keep' } })
    const block = keeping.node('grid', { children: [keeping.repeat(keeping.node('card'), 3)] })
    const home = keeping.page({
      sections: [keeping.section('kept', block), keeping.section('pruned', block, { policies: { onShortage: 'remove' } })],
      data: () => ({ kept: { card: ['a'] }, pruned: { card: ['a'] } }),
    })

    const result = await home.build()

    expect(cards(sectionOf(result, 'kept'))).toHaveLength(3)
    expect(cards(sectionOf(result, 'pruned'))).toHaveLength(1)
  })

  it('reports data without a section and removed sections', async () => {
    const home = ui.page({
      sections: [section('a', node('card')), section('b', node('card'), { remove: 'card' })],
      data: () => ({ a: { card: [] }, ghost: { card: ['x'] } }),
    })

    const result = await home.build()

    expect(result.sections).toEqual([])
    expect(result.report.unknownData).toEqual(['ghost'])
    expect(result.report.removedSections).toEqual(['b', 'a'])
  })

  it('an assign error includes the section key', async () => {
    const home = ui.page({
      sections: [section('news', node('grid', { children: [node('card')] }), { policies: { onShortage: 'error' } })],
      data: () => ({ news: { card: [] } }),
    })

    await expect(home.build()).rejects.toThrow('section "news": assign:')
  })

  it('rejects duplicate section keys', async () => {
    const home = ui.page({ sections: [section('a', node('card')), section('a', node('card'))] })

    await expect(home.layout()).rejects.toThrow('duplicate section key "a"')
  })

  it('build() calls sections(ctx) once', async () => {
    const sections = vi.fn(() => [section('a', node('card', { props: { size: 'small' } }))])
    const home = ui.page({ sections, data: () => ({ a: { card: [{}] } }) })

    await home.build()

    expect(sections).toHaveBeenCalledTimes(1)
  })

  it('a page without a loader', async () => {
    const result = await ui.page({ sections: [section('a', node('card'))] }).build()

    expect(result.data).toEqual({})
    expect(result.sections[0].layout).toEqual({ id: 'a', component: 'card', props: {} })
  })
})

describe('node IDs unique on the page', () => {
  type C = { grid: Record<string, never>; card: { title?: string } }

  it('a custom id generator repeating IDs across sections throws (data would be overwritten silently)', async () => {
    const custom = createDedal<C>({ id: ({ component, path }) => `${component}-${path.join('.')}` })
    const block = custom.node('grid', { children: [custom.node('card')] })
    const page = custom.page({ sections: [custom.section('a', block), custom.section('b', block)] })

    await expect(page.build()).rejects.toThrow('page: duplicate node ID "grid-" in sections "a" and "b" — node IDs must be unique on the page')
  })

  it('a custom generator using the prefix (section key) passes', async () => {
    const custom = createDedal<C>({ id: ({ prefix, path }) => [prefix, ...path].join('/') })
    const block = custom.node('grid', { children: [custom.node('card')] })
    const page = custom.page({ sections: [custom.section('a', block), custom.section('b', block)], data: () => ({ a: { card: [{ title: 'A' }] }, b: { card: [{ title: 'B' }] } }) })
    const result = await page.build()

    expect(result.data).toEqual({ 'a/0': { title: 'A' }, 'b/0': { title: 'B' } })
  })
})
