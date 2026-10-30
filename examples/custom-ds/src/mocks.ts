import type { Article, ArticleSource, Category, ContentApi, Globals, Meta } from './api'

/**
 * Data source mocks. Chosen to show the harder cases: fewer tracks than places (“Recently added”:
 * 7 for 15 / 10 by default — removing tiles and dividers), fewer categories than carousel slots, titles with various
 * separators (" - ", " – ", ": ", "|", a hyphen in the artist name).
 */

const songs = [
  'Lena Birch - Small Town',
  'Duo-Contra - Saviour Square',
  'Ola Wind: Champagne | NEW',
  'Pola Ash – Arahja',
  'Mira Pine - Kinga',
  'Orchestra of Tomorrow - For Us and You',
  'Tom Maple - Polish Tango',
  'Hum - Length of Sound',
  'Hey-Ho - Texan',
  'Basia Hornbeam - Ruckus',
  'Linden Blossom - Late to Bed Tonight',
  'Frost - Gold',
  'Ralph Stone - Cosmic Energies',
  'Owl - Violet Field',
  'Bard 2115 - Wildflower',
  'Annie Oak - Without You',
  'Organs - Mississippi on Fire',
  'Chris Hare - Homeland',
  'Lady Summer - Always Where You Are',
  'Perfekt - Autobiography',
  'Instrumental without an artist',
]

const article = (headline: string, index: number, extra: Partial<Article> = {}): Article => ({
  headline,
  url: `https://example.com/song,id,${7000 + index}`,
  lead: `Lead ${index}`,
  tags: [{ name: 'music' }],
  categories: [{ name: 'Poland' }],
  ...extra,
})

export const mockMeta = (): Meta => ({
  metaTags: { og: { title: 'Custom DS — song lyrics' }, title: 'Custom DS' },
  publisher: { name: 'Custom DS', logo: 'https://images.example.com/logo.png' },
  flags: { hasSitebranding: { desktop: true, mobile: false }, isSitebrandingActive: false },
  envUrl: 'https://example.com',
  viewType: 'FRONTPAGE',
  serviceId: 1,
})

export const mockGlobals = (): Globals => ({
  header: {
    mainMenu: [{ name: 'Lyrics', url: '/lyrics' }, { name: 'Artists', url: '/artists' }],
    logos: { default: 'https://images.example.com/logo.svg' },
    toolbar: [{ name: 'search' }, { name: 'mail' }, { name: 'user' }],
    height: { desktop: '96px', mobile: '56px' },
  },
  breadcrumbs: [{ name: 'Home', url: '/' }],
  footer: { navLink: [{ name: 'Terms', url: '/regulamin' }], copyrightText: '© Custom DS', upperFooter: null },
})

const categories: Category[] = [
  { title: 'Polish rap', url: 'https://example.com/category/polish-rap', description: 'Best verses', cover: { imageId: 'A1' } },
  { title: 'The 80s', url: 'https://example.com/category/80s', lead: 'Classics', imageId: 'A2' },
  { title: 'Ballads', url: 'https://example.com/category/ballads', text: 'Slow tempo', imageId: 'A3' },
  { title: 'Rock', description: 'No URL', imageId: 'A4' },
  { title: 'Disco polo', url: 'https://example.com/category/disco-polo', description: 'For dancing', cover: { imageId: 'A5' } },
]

export type MockOptions = {
  /** Empty “featured” source — the optional section disappears. */
  emptyFeatured?: boolean
  /** Number of tracks in “Recently added” (7 by default — fewer than places: 15 desktop, 10 mobile). */
  recentSongs?: number
}

export function createMockApi(options: MockOptions = {}): ContentApi {
  const sources: Record<ArticleSource, Article[]> = {
    news: Array.from({ length: 6 }, (_, i) => article(`Music news ${i + 1}`, 100 + i)),
    featured: options.emptyFeatured ? [] : songs.slice(0, 6).map((song, i) => article(song, 200 + i, { sourceTitle: 'Summer hits' })),
    trending: songs.slice(0, 20).map((song, i) => article(song, 300 + i)),
    recent: Array.from({ length: options.recentSongs ?? 7 }, (_, i) => article(songs[(14 + i) % songs.length], 400 + i)),
  }

  return {
    meta: async () => mockMeta(),
    globals: async () => mockGlobals(),
    categories: async () => structuredClone(categories),
    articles: async source => structuredClone(sources[source]),
  }
}
