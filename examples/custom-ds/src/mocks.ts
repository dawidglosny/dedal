import type { Article, ArticleSource, Category, ContentApi, Globals, Meta } from './api'

/**
 * Data source mocks. Chosen to show the harder cases: fewer tracks than places (“Ostatnio dodane”:
 * 7 for 15 / 10 by default — removing tiles and dividers), fewer categories than carousel slots, titles with various
 * separators (" - ", " – ", ": ", "|", a hyphen in the artist name).
 */

const songs = [
  'Lena Brzoza - Małe miasto',
  'Duo-Kontra - Plac Zbawiciela',
  'Ola Wiatr: Szampan | NOWOŚĆ',
  'Pola Jesion – Arahja',
  'Mira Sosna - Kinga',
  'Orkiestra Jutra - Sobie i wam',
  'Tomek Klon - Polskie tango',
  'Szum - Długość dźwięku',
  'Hej-Ho - Teksański',
  'Basia Grab - Granda',
  'Kwiat Lipy - Dziś późno pójdę spać',
  'Mróz - Złoto',
  'Rafał Kamień - Kosmiczne energie',
  'Sowa - Fiołkowe pole',
  'Bard 2115 - Kwiat polny',
  'Ania Dąb - Bez ciebie',
  'Organy - Mississippi w ogniu',
  'Krzysztof Zając - Polsko',
  'Pani Lato - Zawsze tam, gdzie ty',
  'Perfekt - Autobiografia',
  'Instrumental bez wykonawcy',
]

const article = (headline: string, index: number, extra: Partial<Article> = {}): Article => ({
  headline,
  url: `https://example.com/utwor,id,${7000 + index}`,
  lead: `Lead ${index}`,
  tags: [{ name: 'muzyka' }],
  categories: [{ name: 'Polska' }],
  ...extra,
})

export const mockMeta = (): Meta => ({
  metaTags: { og: { title: 'Custom DS — teksty piosenek' }, title: 'Custom DS' },
  publisher: { name: 'Custom DS', logo: 'https://images.example.com/logo.png' },
  flags: { hasSitebranding: { desktop: true, mobile: false }, isSitebrandingActive: false },
  envUrl: 'https://example.com',
  viewType: 'FRONTPAGE',
  serviceId: 1,
})

export const mockGlobals = (): Globals => ({
  header: {
    mainMenu: [{ name: 'Teksty', url: '/teksty-piosenek' }, { name: 'Wykonawcy', url: '/wykonawcy' }],
    logos: { default: 'https://images.example.com/logo.svg' },
    toolbar: [{ name: 'search' }, { name: 'mail' }, { name: 'user' }],
    height: { desktop: '96px', mobile: '56px' },
  },
  breadcrumbs: [{ name: 'Strona główna', url: '/' }],
  footer: { navLink: [{ name: 'Regulamin', url: '/regulamin' }], copyrightText: '© Custom DS', upperFooter: null },
})

const categories: Category[] = [
  { title: 'Polski rap', url: 'https://example.com/kategoria/polski-rap', description: 'Najlepsze wersy', cover: { imageId: 'A1' } },
  { title: 'Lata 80', url: 'https://example.com/kategoria/lata-80', lead: 'Klasyka', imageId: 'A2' },
  { title: 'Ballady', url: 'https://example.com/kategoria/ballady', text: 'Wolne tempo', imageId: 'A3' },
  { title: 'Rock', description: 'Bez URL-a', imageId: 'A4' },
  { title: 'Disco polo', url: 'https://example.com/kategoria/disco-polo', description: 'Do tańca', cover: { imageId: 'A5' } },
]

export type MockOptions = {
  /** Empty “featured” source — the optional section disappears. */
  emptyFeatured?: boolean
  /** Number of tracks in “Ostatnio dodane” (7 by default — fewer than places: 15 desktop, 10 mobile). */
  recentSongs?: number
}

export function createMockApi(options: MockOptions = {}): ContentApi {
  const sources: Record<ArticleSource, Article[]> = {
    news: Array.from({ length: 6 }, (_, i) => article(`Aktualność muzyczna ${i + 1}`, 100 + i)),
    featured: options.emptyFeatured ? [] : songs.slice(0, 6).map((song, i) => article(song, 200 + i, { sourceTitle: 'Hity lata' })),
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
