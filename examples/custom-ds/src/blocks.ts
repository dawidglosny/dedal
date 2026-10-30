import { clone, node, repeat } from './ui'

/**
 * Page blocks — plain constants and functions returning blocks (`node`, `repeat`, `clone`), parameterized
 * instead of copied per platform.
 */

// --- track lists (tile + divider)

const songTile = () =>
  node('tile-v2', {
    props: { variant: 'horizontal', size: 'large', background: false },
    children: [node('image-holder')],
  })

const smallDivider = () => node('divider', { props: { thickness: 'small' } })

/** Track list column: `count` × (tile + divider). */
export const songColumn = (count: number) =>
  node('wrapper-group', {
    props: { colSpan: 4, gapVertical: 'xsmall', layout: 'flex', direction: 'column' },
    children: clone(count, songTile(), smallDivider()),
  })

/** Column with a box300x250 ad between dividers. */
export const adColumn = node('wrapper-layout', {
  props: { colSpan: 4, layout: 'flex', direction: 'column', justify: 'start', gapVertical: 'none' },
  children: [
    smallDivider(),
    node('ad', { props: { type: 'box300x250', divider: 'none', floating: 52 } }),
    smallDivider(),
  ],
})

const songListContainerProps = {
  backgroundScheme: 'outside',
  backgroundVariant: 'full',
  width: 'full-desktop-limited',
  paddingTop: true,
  paddingBottom: true,
  paddingHorizontal: true,
  marginBottom: true,
  marginTop: false,
}

const xlargeHeader = () =>
  node('wrapper-layout', {
    props: { colSpan: 12, layout: 'flex', align: 'center', justify: 'center' },
    children: [node('block-header', { props: { size: 'xlarge', showDivider: false } })],
  })

/** “Trending” on desktop: header + two columns of 10 tracks + an ad column. */
export const trending = node('wrapper-container', {
  props: songListContainerProps,
  children: [
    node('wrapper-layout', {
      props: { colSpan: 12, columns: 12, gapVertical: 'scattered' },
      children: [
        xlargeHeader(),
        node('wrapper-layout', {
          props: { colSpan: 12, columns: 12, gapHorizontal: 'normal' },
          alias: 'article-embers-wrapper',
          children: [songColumn(10), songColumn(10), adColumn],
        }),
      ],
    }),
  ],
})

/** Track list on desktop: header + columns of `groupCounts[i]` tracks. */
export const songList = (groupCounts: number[]) =>
  node('wrapper-container', {
    props: songListContainerProps,
    children: [
      node('wrapper-layout', {
        props: { colSpan: 12, columns: 12, gapVertical: 'scattered' },
        children: [
          xlargeHeader(),
          node('wrapper-layout', {
            props: { colSpan: 12, columns: 12, gapHorizontal: 'normal' },
            children: groupCounts.map(songColumn),
          }),
        ],
      }),
    ],
  })

/** Track list on mobile: header + `count` × (tile + divider) in a single column. */
export const songListMob = (count: number) =>
  node('wrapper-container', {
    props: { paddingHorizontal: true, paddingTop: true, paddingBottom: true, marginBottom: true, marginTop: false },
    children: [
      node('wrapper-layout', {
        props: { colSpan: 12, columns: 1, gapVertical: 'normal' },
        children: [
          node('wrapper-layout', {
            props: { colSpan: 1, layout: 'flex', justify: 'center' },
            children: [node('block-header', { props: { size: 'small', showDivider: false } })],
          }),
          node('wrapper-group', {
            props: { colSpan: 1, gapVertical: 'xsmall', layout: 'flex', direction: 'column' },
            children: clone(count, songTile(), smallDivider()),
          }),
        ],
      }),
    ],
  })

// --- ads

const adBanner = (containerProps: Record<string, unknown>, adProps: Record<string, unknown>, alias?: string) =>
  node('wrapper-container', {
    props: { paddingTop: false, paddingBottom: false, marginBottom: false, ...containerProps },
    children: [
      node('wrapper-layout', {
        props: { colSpan: 12 },
        children: [node('ad', { props: adProps, ...(alias && { alias }) })],
      }),
    ],
  })

const limited = { width: 'full-desktop-limited', className: 'ids-desktop-max-width-limited' }

export const topCenterAd = adBanner({ ...limited, backgroundWhenScreening: 'transparent' }, { type: 'top_center' }, 'adBanner')
export const topCenterAdMob = adBanner({ backgroundWhenScreening: 'transparent' }, { type: 'top_center', size: 'small' }, 'adBanner')
export const bottomCenterAd = adBanner(limited, { type: 'bottom_center' })
export const bottomCenterAdMob = adBanner({}, { type: 'bottom_center', size: 'small' })
export const box300x250AdMob = adBanner({ width: 'auto' }, { type: 'box300x250', size: 'small' })

// --- category carousel

/** Maximum number of categories in the carousel; surplus items disappear when data is assigned. */
export const CATEGORY_SLOTS = 12

/**
 * Category carousel with a header. Items (special-content with an image in the `secondaryComponent` slot) are in
 * the layout: slot list `items` with `CATEGORY_SLOTS` items, trimmed to the number of categories when data is assigned.
 * Carousel images don't use the default `responsiveData`.
 */
export const categoriesCarousel = node('wrapper-container', {
  children: [
    node('wrapper-layout', {
      props: { colStart: 1, colEnd: 13, columns: 1, layout: 'flex', direction: 'column' },
      children: [
        node('wrapper-layout', {
          alias: 'carousel-header',
          children: [node('block-header')],
        }),
        node('wrapper-layout', {
          props: { layout: 'flex' },
          children: [
            node('carousel', {
              props: { step: 4 },
              slots: {
                items: [
                  repeat(
                    node('special-content', {
                      slots: { secondaryComponent: node('image-holder', { props: { responsiveData: undefined } }) },
                    }),
                    CATEGORY_SLOTS
                  ),
                ],
              },
            }),
          ],
        }),
      ],
    }),
  ],
})

// --- news

/** News on desktop: header + 2 large cards + 4 small ones. */
export const latestNews = node('wrapper-container', {
  props: {
    mode: 'inverted',
    backgroundVariant: 'full',
    paddingHorizontal: true,
    paddingTop: 2,
    paddingBottom: 2,
    marginTop: false,
    marginBottom: false,
  },
  children: [
    node('wrapper-layout', {
      props: { testId: 'articles-section', columns: 2, colSpan: 12 },
      children: [
        node('wrapper-layout', {
          alias: 'news-header',
          props: { columns: 1, colSpan: 12 },
          children: [
            node('block-header', {
              props: { inverted: true, size: 'xlarge', showDivider: false, style: { textAlign: 'center', margin: '0 auto' } },
            }),
          ],
        }),
        node('wrapper-layout', {
          props: { columns: 4, colSpan: 12 },
          alias: 'news-cards',
          children: [
            repeat(
              node('wrapper-layout', {
                props: { colSpan: 2 },
                alias: 'news-cards-first-row',
                children: [node('card', { props: { variant: 'overlay', size: 'large', surface: false, aspect: '16:9' } })],
              }),
              2
            ),
            node('wrapper-layout', {
              props: { colSpan: 4, columns: 4 },
              alias: 'news-cards-other-rows',
              children: [repeat(node('card', { props: { size: 'small', variant: 'overlay', surface: false, aspect: '16:9' } }), 4)],
            }),
          ],
        }),
      ],
    }),
  ],
})

/** News on mobile: header + 6 cards in a single column. */
export const latestNewsMob = node('wrapper-container', {
  props: {
    mode: 'inverted',
    backgroundVariant: 'full',
    paddingTop: 2,
    paddingBottom: 2,
    marginTop: false,
    marginBottom: false,
    paddingHorizontal: true,
  },
  children: [
    node('wrapper-layout', {
      props: { testId: 'articles-section', colSpan: 12, columns: 12 },
      children: [
        node('wrapper-layout', {
          props: { colSpan: 12, columns: 1 },
          children: [
            node('block-header', {
              props: { inverted: true, size: 'small', showDivider: false, style: { textAlign: 'center', margin: '0 auto' } },
            }),
          ],
        }),
        node('wrapper-layout', {
          props: { colSpan: 12, columns: 1 },
          alias: 'wrapper-cards',
          children: [
            repeat(
              node('card', { alias: 'cards', props: { variant: 'overlay', surface: false, size: 'small', aspect: '16:9' } }),
              6
            ),
          ],
        }),
      ],
    }),
  ],
})

// --- CTA

/**
 * CTA: text with a logo in the `secondaryComponent` slot + an image beside it. On mobile the section removes the logo
 * (`remove`).
 */
export const cta = node('wrapper-container', {
  props: {
    backgroundVariant: 'full',
    width: 'full-desktop-limited',
    paddingHorizontal: true,
    paddingTop: 2,
    paddingBottom: 2,
    marginTop: false,
    marginBottom: true,
  },
  children: [
    node('wrapper-layout', {
      props: { columns: 2, colSpan: 12 },
      children: [
        node('wrapper-layout', {
          props: { colSpan: 1 },
          children: [
            node('special-content', {
              props: { inverted: true, align: 'left', size: 'medium', inGrid: true },
              slots: { secondaryComponent: node('image-holder', { props: { responsiveData: undefined, frameClass: undefined } }) },
            }),
          ],
        }),
        node('wrapper-layout', { props: { colSpan: 1 }, children: [node('image-holder')] }),
      ],
    }),
  ],
})

// --- SEO / tracking

export const homeJsonLd = node('home-json-ld')
export const homeTracking = node('home-tracking')

// --- shared sections (header, breadcrumbs, footer)

/** Header: sitebranding ad + site header. */
export const serviceHeader = (mobile: boolean) =>
  node('wrapper-container', {
    props: {
      width: 'full',
      paddingHorizontal: false,
      paddingTop: false,
      paddingBottom: false,
      marginBottom: false,
      position: { type: 'fixed' },
    },
    children: [
      node('wrapper-layout', {
        props: { colSpan: 12 },
        children: [
          node('floating-headers', {
            children: [
              node('ad', { props: { type: 'sitebranding', isExpected: false, ...(mobile && { size: 'small' }) } }),
              node('service-header', mobile ? { props: { mobile: true } } : {}),
            ],
          }),
        ],
      }),
    ],
  })

/** Breadcrumbs. */
export const breadcrumbs = (mobile: boolean) =>
  node('wrapper-container', {
    props: { ...(!mobile && { width: 'full-desktop-limited' }), paddingTop: false, paddingBottom: false, marginBottom: false },
    children: [
      node('wrapper-group', {
        props: { colSpan: 12, ...(mobile && { layout: 'flex' }), padding: { top: 'small', bottom: 'small' } },
        children: [node('breadcrumbs')],
      }),
    ],
  })

/** Footer. */
export const serviceFooter = node('wrapper-container', {
  props: { width: 'full', paddingHorizontal: null, paddingTop: null, paddingBottom: null },
  children: [node('wrapper-layout', { props: { colSpan: 12 }, children: [node('footer')] })],
})
