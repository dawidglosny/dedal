import { fetchArticles } from '@/content/articles'
import type { Contract, Ctx } from './contract'
import { node, repeat, section, ui } from './dedal'

// --- blocks: plain functions, parameterized instead of copied per platform

const heroBlock = node('hero', {
  slots: {
    media: node('image'),
    actions: [node('button'), node('button', { props: { variant: 'outline' } })],
  },
})

const cardsBlock = ({
  title,
  description,
  columns,
  cards,
}: {
  title: string
  description?: string
  columns: Contract['grid']['columns']
  cards: number
}) =>
  node('section', {
    props: { title, description },
    children: [
      node('grid', {
        props: { columns },
        children: [repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), cards)],
      }),
    ],
  })

const tabsBlock = node('section', {
  props: { title: 'Na skróty' },
  children: [
    node('tabs', {
      props: { labels: ['Najnowsze', 'Popularne'] },
      slots: { content: [node('list'), node('list')] },
    }),
  ],
})

// --- data: query cached in the instance, shared by the page and sections

export const articlesQuery = ui.query({
  key: (count: number) => ['articles', count],
  fn: fetchArticles,
})

// --- page

export const home = ui.page<Ctx>({
  sections: ({ device }) => [
    section('hero', heroBlock),
    section(
      'latest',
      cardsBlock({ title: 'Najnowsze', description: 'Karty ze slotami: badge i stopka z autorem', columns: device === 'mobile' ? 1 : 3, cards: 6 }),
      // featured first card (spanning 2 columns) only where the grid has more than 1 column
      device === 'desktop' ? { patch: { 'grid > card:first-child': { size: 'lg' } } } : {}
    ),
    // deferred section: the page result holds only a fallback; the content is built separately by page.section() —
    // streamed through <Suspense>, outside the page cache (the place for personalized data)
    section(
      'forYou',
      cardsBlock({ title: 'Dla Ciebie', description: 'Sekcja odroczona — streamowana osobno', columns: device === 'mobile' ? 1 : 3, cards: 3 }),
      {
        defer: { fallback: node('section', { props: { title: 'Dla Ciebie', description: 'Ładowanie rekomendacji…' } }) },
        data: async () => {
          await new Promise(resolve => setTimeout(resolve, 600)) // simulated slow recommendations API
          // the query result is read-only — copy before reverse()
          const picks = [...(await articlesQuery(12))].reverse().slice(0, 3)
          return {
            card: picks,
            'card > :slot(badge)': picks.map(a => a.category),
            'card > :slot(footer)': picks.map(a => a.author),
          }
        },
      }
    ),
    section('divider', node('separator')),
    section('shortcuts', tabsBlock),
    section('more', cardsBlock({ title: 'Więcej', columns: device === 'mobile' ? 2 : 4, cards: 8 }), {
      // compact version: no author footer, smaller cards
      remove: 'card > :slot(footer)',
      patch: { card: { size: 'sm' } },
    }),
  ],

  // build result cache (staleTime 5 s, maxAge 5 min — instance defaults); the key covers everything
  // the sections and data depend on — here only device
  cache: { key: ctx => ['home', ctx.device] },

  data: async () => {
    const articles = await articlesQuery(12)
    const [featured, ...rest] = articles
    const latest = rest.slice(0, 6)
    const more = rest.slice(6)

    return {
      hero: {
        hero: [featured],
        image: [featured],
        'hero > :slot(actions)': [
          { label: 'Czytaj', href: `/artykul/${featured.slug}` },
          { label: 'Wszystkie artykuły', href: '#latest' },
        ],
      },
      latest: {
        card: latest,
        'card > :slot(badge)': latest.map(a => a.category),
        'card > :slot(footer)': latest.map(a => a.author),
      },
      shortcuts: { list: [rest.slice(0, 4), [...rest].reverse().slice(0, 4)] },
      // 5 articles for 8 places → the default onShortage: 'remove' removes 3 empty cards
      more: {
        card: more,
        'card > :slot(badge)': more.map(a => a.category),
      },
    }
  },
})
