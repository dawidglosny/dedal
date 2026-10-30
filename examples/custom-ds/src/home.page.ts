import type { PropsPatch } from 'dedal'
import { SITE_NAME, type ContentApi, type Meta } from './api'
import * as blocks from './blocks'
import type { Ctx, Device } from './contract'
import { categoriesCarousel, news, songTiles } from './helpers'
import { createInstance, section } from './ui'

/**
 * Home page of a song lyrics site on a custom design system.
 *
 * - Data sources → queries (`ui.query`) — cached in the instance, shared by the page and the shared sections.
 * - Header, breadcrumbs, footer → shared sections with their own loaders.
 * - Section data → bindings per selector (`{ 'block-header': [...], 'tile-v2': [...], 'image-holder': [...] }`).
 * - Desktop / mobile variants → `sections(ctx)`; section patches → selectors (`tile-v2`, `:root`, `:root > wrapper-layout`).
 */

/** Single-line tile: truncated title and artist. */
const tileClamp = {
  labelStyles: { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  detailsStyles: { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
}

const categoriesPatch = (device: Device): PropsPatch =>
  device === 'desktop'
    ? {
        ':root': {
          backgroundScheme: 'outside',
          backgroundVariant: 'full',
          width: 'full-desktop-limited',
          paddingTop: true,
          paddingHorizontal: true,
          paddingBottom: 2,
          marginTop: false,
          marginBottom: true,
        },
        'block-header': { showDivider: false, size: 'xlarge', style: { textAlign: 'center', margin: '0 auto' } },
        carousel: { step: 2, length: 2, buttonVariant: 'ghost' },
      }
    : {
        ':root': { backgroundVariant: 'full', paddingTop: true, paddingBottom: true, paddingHorizontal: true, marginTop: false, marginBottom: true },
        'block-header': { showDivider: false, size: 'small', style: { textAlign: 'center', margin: '0 auto' } },
        carousel: { size: 'small', step: 1, length: 1 },
      }

const ctaPatch = (device: Device): PropsPatch =>
  device === 'desktop'
    ? { ':root': { mode: 'inverted' } }
    : {
        ':root': { mode: 'inverted', paddingHorizontal: true },
        'wrapper-layout': { columns: 1, colSpan: 1 },
        // outer wrapper-layout (text / image columns): on mobile one below the other, image above text
        ':root > wrapper-layout': { colSpan: 12, style: { display: 'flex', flexDirection: 'column-reverse' } },
        'special-content': { size: 'small', align: 'center', inverted: true },
      }

export function createHomePage(api: ContentApi) {
  // own instance: the query and page cache belongs to this data source
  const ui = createInstance()

  // --- queries

  const metaQuery = ui.query({ key: (url: string) => ['meta', url], fn: url => api.meta(url) })
  const globalsQuery = ui.query({ key: (url: string) => ['globals', url], fn: url => api.globals(url) })
  const categoriesQuery = ui.query({ key: () => ['categories'], fn: () => api.categories() })
  const articlesQuery = ui.query({
    key: (source: Parameters<ContentApi['articles']>[0]) => ['articles', source],
    fn: source => api.articles(source),
  })

  /** Page meta with the site name in `og.site_name`. The query result is read-only — changes go on a copy. */
  const metaFor = async (ctx: Ctx): Promise<Meta> => {
    const meta = await metaQuery(ctx.url)
    return { ...meta, metaTags: { ...meta.metaTags, charset: meta.metaTags.charset || 'utf-8', og: { ...meta.metaTags.og, site_name: SITE_NAME } } }
  }

  // --- shared sections

  const header = (device: Device) =>
    section('header', blocks.serviceHeader(device === 'mobile'), {
      data: async (ctx: Ctx) => {
        const [meta, globals] = await Promise.all([metaFor(ctx), globalsQuery(ctx.url)])
        const hasSitebranding = meta.flags?.hasSitebranding ?? { desktop: false, mobile: false }

        return {
          ad: [{ isExpected: hasSitebranding[device] ?? false, isSitebrandingActive: meta.flags?.isSitebrandingActive ?? false, hasSitebranding }],
          'service-header': [
            {
              title: meta.publisher.name ?? meta.metaTags.title ?? '',
              height: globals.header.height?.[device],
              navigationLinks: globals.header.mainMenu,
              logoData: globals.header.logos,
              // site without mail in the header
              toolbar: globals.header.toolbar?.filter(item => item.name !== 'mail'),
              isMailHidden: true,
            },
          ],
        }
      },
    })

  const breadcrumbs = (device: Device) =>
    section('breadcrumbs', blocks.breadcrumbs(device === 'mobile'), {
      patch: {
        ':root': { marginBottom: false, mode: 'special-1', backgroundVariant: 'full', backgroundScheme: 'inside-outside' },
        breadcrumbs: { mode: 'inverted' },
      },
      data: async (ctx: Ctx) => {
        const [meta, globals] = await Promise.all([metaFor(ctx), globalsQuery(ctx.url)])
        return { breadcrumbs: [{ items: globals.breadcrumbs, serviceUrl: meta.envUrl }] }
      },
    })

  const footer = section('footer', blocks.serviceFooter, {
    data: async (ctx: Ctx) => {
      const { footer: data } = await globalsQuery(ctx.url)
      return {
        footer: [
          {
            navigationList: data.navLink,
            copyrightBarContent: data.copyrightText,
            upperFooter: data.upperFooter,
            showBlockLinks: true,
            linkGroups: [],
            description: 'Lyrics by Polish and international artists, translations and music videos — regularly updated.',
          },
        ],
      }
    },
  })

  // --- page

  const home = ui.page<Ctx>({
    sections: ({ device }) => {
      const desktop = device === 'desktop'
      return [
        header(device),
        breadcrumbs(device),
        // list sections: empty when no tile got data (the header always gets it) — removed by default (onEmpty)
        section('featured', desktop ? blocks.songList([2, 2, 2]) : blocks.songListMob(6), {
          required: 'tile-v2',
          patch: desktop ? { 'tile-v2': tileClamp } : { ':root': { backgroundVariant: 'full' }, 'tile-v2': tileClamp },
        }),
        section('trending', desktop ? blocks.trending : blocks.songListMob(10), {
          required: 'tile-v2',
          patch: { 'tile-v2': tileClamp },
        }),
        section('topCenter', desktop ? blocks.topCenterAd : blocks.topCenterAdMob, {
          ...(desktop && { patch: { ':root': { backgroundVariant: 'full' } } }),
        }),
        section('categories', blocks.categoriesCarousel, { patch: categoriesPatch(device) }),
        ...(desktop
          ? []
          : [section('middleSliderAd', blocks.box300x250AdMob, { patch: { ':root': { backgroundVariant: 'full', paddingHorizontal: true } } })]),
        section('recentlyAdded', desktop ? blocks.songList([5, 5, 5]) : blocks.songListMob(10), {
          required: 'tile-v2',
          patch: desktop ? { 'tile-v2': tileClamp } : { ':root': { backgroundVariant: 'full' }, 'tile-v2': tileClamp },
        }),
        section('latestNews', desktop ? blocks.latestNews : blocks.latestNewsMob),
        section('ctaSection', blocks.cta, {
          patch: ctaPatch(device),
          // logo in the CTA only on desktop
          ...(!desktop && { remove: 'special-content > :slot(secondaryComponent)' }),
        }),
        section('bottomCenter', desktop ? blocks.bottomCenterAd : blocks.bottomCenterAdMob, {
          patch: desktop ? { ':root': { backgroundVariant: 'full' } } : { ad: { size: 'medium' } },
        }),
        section('homeJsonLd', blocks.homeJsonLd),
        section('homeTracking', blocks.homeTracking),
        footer,
      ]
    },

    data: async ctx => {
      const mobile = ctx.device === 'mobile'
      const [meta, globals, categories, newsRaw, featuredRaw, trendingRaw, recentRaw] = await Promise.all([
        metaFor(ctx),
        globalsQuery(ctx.url),
        categoriesQuery(),
        articlesQuery('news'),
        articlesQuery('featured'),
        articlesQuery('trending'),
        articlesQuery('recent'),
      ])

      // preload only the first cover on the page — order: featured, trending, recently added
      const preloaded = new Set<string>()
      const featured = songTiles(featuredRaw, String(featuredRaw[0]?.sourceTitle || 'Featured'), 6, undefined, preloaded)
      const trending = songTiles(trendingRaw, 'Featured song lyrics', mobile ? 10 : 20, '/trending', preloaded)
      const recent = songTiles(recentRaw, 'Recently added', mobile ? 10 : 15, '/lyrics', preloaded)
      const carousel = categoriesCarousel(categories, ctx.device)
      const latest = news(newsRaw)

      return {
        featured: { 'block-header': [featured.header], 'tile-v2': featured.tiles, 'image-holder': featured.images },
        trending: {
          'block-header': [trending.header],
          'tile-v2': trending.tiles,
          'image-holder': trending.images,
          ...(!mobile && { ad: [{ type: 'box300x250', divider: 'none' }] }),
        },
        categories: {
          'block-header': [carousel.header],
          carousel: [carousel.carousel],
          // carousel items and their images — surplus slots (CATEGORY_SLOTS) disappear (onShortage: 'remove')
          'special-content': carousel.items,
          'special-content > :slot(secondaryComponent)': carousel.images,
        },
        recentlyAdded: {
          'block-header': [recent.header],
          'tile-v2': recent.tiles,
          'image-holder': recent.images,
          // mobile: a removed tile also takes the divider before it
          ...(mobile && { divider: relatedDividers(recent.tiles.length, 10) }),
        },
        latestNews: { 'block-header': [latest.header], card: latest.cards },
        ctaSection: {
          'special-content': [
            {
              header: 'Get closer to the stars',
              text: 'Album reviews, interviews and live concert energy — everything that matters in music.',
              buttons: [
                { children: 'Go to the site', variant: 'primary', type: 'link', href: 'https://example.com/muzyka', asset: 'arrow-faced-right', iconPosition: 'trailing' },
              ],
            },
          ],
          // specific selector (logo in a slot) before the general one (`image-holder`) — the earlier selector takes the node
          ...(!mobile && {
            'special-content > :slot(secondaryComponent)': [{ key: 'image-holder', src: 'https://images.example.com/logo.webp', alt: 'Logo' }],
          }),
          'image-holder': [{ src: 'https://images.example.com/cta.webp', alt: 'Get closer to the stars', loading: 'lazy' }],
        },
        homeJsonLd: { 'home-json-ld': [{ mainMenuItems: globals.header.mainMenu, meta, publisher: meta.publisher }] },
        homeTracking: { 'home-tracking': [{ site: meta.viewType?.toLowerCase() || 'frontpage', serviceId: meta.serviceId }] },
      }
    },
  })

  return { ui, home }
}

/**
 * Dividers in the list `tile, divider, tile, divider, …` (one after each tile) with `tiles` tiles with data
 * in `slots` places: each removed tile takes the divider BEFORE it, the last divider stays.
 * Dividers have their own binding: `{}` = stays, `null` = no data → removed (onShortage: 'remove').
 */
function relatedDividers(tiles: number, slots: number) {
  if (tiles >= slots) return { items: Array.from({ length: slots }, () => ({})) }
  const kept = Math.max(tiles - 1, 0)
  return { items: [...Array.from({ length: kept }, () => ({})), ...Array.from({ length: slots - 1 - kept }, () => null), {}] }
}
