import { describe, expect, it } from 'vitest'
import type { Device } from '../src/contract'
import { parseTrackTile } from '../src/helpers'
import { createHomePage } from '../src/home.page'
import { createMockApi, type MockOptions } from '../src/mocks'

const build = async (device: Device, mock: MockOptions = {}) => {
  const { ui, home } = createHomePage(createMockApi(mock))
  const result = await home.build({ device, url: 'https://example.com' })
  return { result, resolved: ui.resolve(result) }
}

const sectionTree = (resolved: Awaited<ReturnType<typeof build>>['resolved'], key: string) =>
  resolved.sections.find(section => section.key === key)!.tree

describe('page on a custom design system', () => {
  it.each(['desktop', 'mobile'] as const)('%s: all sections, no resolve issues', async device => {
    const { result, resolved } = await build(device)

    expect(resolved.issues).toEqual([])
    expect(result.report.unknownData).toEqual([])
    expect(result.sections.map(({ key }) => key)).toEqual([
      'header',
      'breadcrumbs',
      'featured',
      'trending',
      'topCenter',
      'categories',
      ...(device === 'mobile' ? ['middleSliderAd'] : []),
      'recentlyAdded',
      'latestNews',
      'ctaSection',
      'bottomCenter',
      'homeJsonLd',
      'homeTracking',
      'footer',
    ])
  })

  it('an empty source removes the data-dependent section', async () => {
    const { result } = await build('desktop', { emptyFeatured: true })

    expect(result.sections.map(({ key }) => key)).not.toContain('featured')
    expect(result.report.removedSections).toEqual(['featured'])
    expect(result.report.emptySections).toEqual(['featured'])
  })

  it('with missing data a tile and its cover stay paired, the divider disappears together with the tile', async () => {
    const { resolved } = await build('mobile', { recentSongs: 7 })
    const group = sectionTree(resolved, 'recentlyAdded').children![0].children![1]
    const tiles = group.children!.filter(node => node.component === 'tile-v2')

    expect(tiles).toHaveLength(7)
    for (const tile of tiles) {
      expect(tile.props).toHaveProperty('label')
      expect(tile.children![0].props).toHaveProperty('src')
    }
    expect(group.children!.map(node => node.component)).toEqual(Array(7).fill(['tile-v2', 'divider']).flat())
  })

  it('carousel: items trimmed to the number of categories, images in the slot', async () => {
    const { resolved } = await build('desktop')
    const carousel = sectionTree(resolved, 'categories').children![0].children![1].children![0]
    const items = carousel.slots!.items as { props: Record<string, unknown>; slots?: Record<string, { props: Record<string, unknown> }> }[]

    expect(items).toHaveLength(5)
    expect(items[0].props.header).toBe('Polish rap')
    expect(items[0].slots!.secondaryComponent.props.imageId).toBe('A1')
    expect(carousel.props).toMatchObject({ autoRotate: false, step: 2, buttonVariant: 'ghost' })
  })

  it('CTA: logo in the slot on desktop only, the image beside it gets its own data', async () => {
    const desktop = JSON.stringify(sectionTree((await build('desktop')).resolved, 'ctaSection'))
    const mobile = JSON.stringify(sectionTree((await build('mobile')).resolved, 'ctaSection'))

    expect(desktop).toContain('logo.webp')
    expect(desktop).toContain('cta.webp')
    expect(mobile).not.toContain('logo.webp')
    expect(mobile).toContain('cta.webp')
  })

  it('section patches: :root and a direct child of the root', async () => {
    const cta = sectionTree((await build('mobile')).resolved, 'ctaSection')
    const outer = cta.children![0]

    expect(cta.props).toMatchObject({ mode: 'inverted', paddingHorizontal: true })
    expect(outer.props).toMatchObject({ columns: 1, colSpan: 12, style: { flexDirection: 'column-reverse' } })
    expect(outer.children!.map(column => (column.props as Record<string, unknown>).colSpan)).toEqual([1, 1])
  })

  it('cards: data in the data prop, tracking alongside, no categories', async () => {
    const { resolved } = await build('desktop')
    const card = JSON.parse(JSON.stringify(sectionTree(resolved, 'latestNews'))).children[0].children[1].children[0].children[0]

    expect(card.component).toBe('card')
    expect(card.props.data.headline).toBe('Music news 1')
    expect(card.props.data).not.toHaveProperty('categories')
    expect(card.props.setupTracking.props.ec3).toBe('link_0')
  })

  it('shared data fetched once per page (queries)', async () => {
    let calls = 0
    const api = createMockApi()
    const counted = { ...api, globals: (url: string) => (calls++, api.globals(url)) }
    const { home } = createHomePage(counted)

    await home.build({ device: 'desktop', url: 'https://example.com' })

    // header, breadcrumbs, footer and page data — a single call
    expect(calls).toBe(1)
  })
})

describe('parseTrackTile', () => {
  it.each([
    ['Lena Birch - Small Town', 'Lena Birch', 'Small Town'],
    ['Duo-Contra - Saviour Square', 'Duo-Contra', 'Saviour Square'],
    ['Ola Wind: Champagne | NEW', 'Ola Wind', 'Champagne'],
    ['Pola Ash – Arahja', 'Pola Ash', 'Arahja'],
    ['Instrumental without an artist', '', 'Instrumental without an artist'],
  ])('%s', (raw, artist, titleDisplay) => {
    expect(parseTrackTile(raw)).toEqual({ artist, titleDisplay })
  })
})
