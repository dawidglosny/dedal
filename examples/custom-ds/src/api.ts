/**
 * Page data sources — in the example passed from outside (`createHomePage(api)`), in tests and the demo: mocks.
 */
export type Article = {
  headline: string
  url: string
  lead?: string
  sourceTitle?: string
  tags?: { name: string }[]
  categories?: unknown[]
  [field: string]: unknown
}

export type Category = {
  title: string
  url?: string
  description?: string
  lead?: string
  text?: string
  cover?: { imageId?: string }
  imageId?: string
}

export type Meta = {
  metaTags: { og: Record<string, unknown>; title?: string; charset?: string; [field: string]: unknown }
  publisher: { name?: string; [field: string]: unknown }
  flags?: { hasSitebranding?: { desktop: boolean; mobile: boolean }; isSitebrandingActive?: boolean }
  envUrl?: string
  viewType?: string
  serviceId?: number
  [field: string]: unknown
}

export type Globals = {
  header: {
    mainMenu?: unknown
    logos?: unknown
    toolbar?: { name: string; [field: string]: unknown }[]
    height?: Record<string, unknown>
  }
  breadcrumbs?: unknown
  footer: { navLink?: unknown; copyrightText?: unknown; upperFooter?: unknown }
}

/** Page article lists. */
export type ArticleSource = 'news' | 'featured' | 'trending' | 'recent'

export type ContentApi = {
  meta(url: string): Promise<Meta>
  globals(url: string): Promise<Globals>
  categories(): Promise<Category[]>
  articles(source: ArticleSource): Promise<Article[]>
}

export const SITE_NAME = 'Custom DS'
