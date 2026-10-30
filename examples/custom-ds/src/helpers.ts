import type { Article, Category } from './api'
import type { Device } from './contract'

/**
 * Section data prepared per component — ready for selector bindings
 * (`{ 'block-header': [header], 'tile-v2': tiles, 'image-holder': images }`).
 */

// --- track title

const DASH_SEPARATORS = [' - ', ' – ', ' — ']
const COLON_SEPARATORS = [': ']

const firstHit = (text: string, separators: string[]) => {
  let best: { index: number; sep: string } | null = null
  for (const sep of separators) {
    const index = text.indexOf(sep)
    if (index !== -1 && (best === null || index < best.index)) best = { index, sep }
  }
  return best
}

const stripPipe = (title: string) => {
  const index = title.indexOf('|')
  return index === -1 ? title : title.slice(0, index).trim()
}

/**
 * Artist and title from the heading: artist = before the first separator (" - " with spaces takes precedence over ": ",
 * so a hyphen in the artist name stays), title = the rest without the metadata after "|".
 */
export function parseTrackTile(raw: string) {
  const work = (raw ?? '').replace(/\s+/g, ' ').trim()
  const chosen = firstHit(work, DASH_SEPARATORS) ?? firstHit(work, COLON_SEPARATORS)

  if (!chosen) return { artist: '', titleDisplay: stripPipe(work) }

  return {
    artist: work.slice(0, chosen.index).trim(),
    titleDisplay: stripPipe(work.slice(chosen.index + chosen.sep.length).trim()),
  }
}

// --- track tiles

const COVER_SRC = 'https://images.example.com/cover.webp'

/** Track list: header, tiles (artist, title) and covers. The first cover on the page gets `preload`. */
export function songTiles(items: Article[], title: string, limit: number, headerUrl?: string, preloaded?: Set<string>) {
  const sliced = (items ?? []).slice(0, limit)

  return {
    header: headerUrl ? { children: title, headerUrl } : { children: title },
    tiles: sliced.map(item => {
      const parsed = parseTrackTile(item.headline)
      return { label: parsed.titleDisplay, details: parsed.artist, url: item.url || '#' }
    }),
    images: sliced.map(() => {
      const preload = preloaded ? !preloaded.has(COVER_SRC) : false
      if (preload) preloaded!.add(COVER_SRC)
      return { src: COVER_SRC, alt: 'Album cover', ...(preload && { preload: true }) }
    }),
  }
}

// --- category carousel

const tracking = (title: string | undefined, event: 'view' | 'click') => ({
  ec0: 'category_button',
  ec1: title?.replace(/\s/g, '_').toLowerCase(),
  ec2: event,
})

/** Category carousel: props of items (special-content) and of their images separately — items are in the layout (slots). */
export function categoriesCarousel(categories: Category[], device: Device) {
  return {
    header: { children: 'Topic categories', headerUrl: '/topic-categories' },
    carousel: { autoRotate: false },
    items: (categories ?? []).map(item => ({
      size: device === 'mobile' ? 'small' : 'medium',
      align: 'center',
      header: item.title,
      text: item.description || item.lead || item.text,
      inGrid: true,
      buttons: [
        {
          children: 'See songs',
          variant: 'primary',
          asset: 'arrow-faced-right',
          iconPosition: 'trailing',
          href: item.url ? new URL(item.url).pathname : '/',
          type: 'link',
          tracking: { view: tracking(item.title, 'view'), click: tracking(item.title, 'click') },
        },
      ],
    })),
    images: (categories ?? []).map(item => ({
      key: 'image-holder',
      frameClass: 'C0',
      imageId: item.cover?.imageId || item.imageId,
      extension: 'webp',
      alt: `Cover: ${item.title}`,
      loading: 'lazy',
      aspectRatio: '16 / 9',
      style: { width: '100%', height: 'auto' },
    })),
  }
}

// --- news

/** News: header with visibility tracking, cards with click tracking; cards without `categories`. */
export function news(articles: Article[]) {
  return {
    header: {
      children: 'News',
      setupTracking: { component: 'tracking-wrapper', props: { ec0: 'news_block', ec1: 'news', ec2: 'view' } },
    },
    cards: articles.map(({ categories: _categories, ...article }, index) => ({
      ...article,
      url: `${article.url}#source=latestNews`,
      setupTracking: {
        component: 'tracking-wrapper-click-event',
        props: { ec0: 'news_block', ec1: 'news', ec2: 'click', ec3: `link_${index}`, ec4: article.url.split(',')?.[2] },
      },
    })),
  }
}
