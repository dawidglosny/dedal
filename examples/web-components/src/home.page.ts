import type { SectionOptions } from 'dedal'
import { api } from './api'
import type { Contract, Ctx } from './contract'
import { loadTemplates } from './templates'
import { ui } from './ui'

// the layout is data, not code: a JSON file here, a database or a design-tool export in a real project
const file = new URL('../templates/home.json', import.meta.url)

/** Section options that belong to the code, not to the template: here, "For you" is deferred — slow and personal. */
const sectionOptions: Record<string, SectionOptions<Contract, Ctx>> = {
  forYou: {
    defer: { fallback: ui.node('skeleton', { props: { label: 'Loading recommendations…', count: 3 } }) },
    optional: true, // if the recommendations fail, the placeholder just disappears
    data: async () => {
      const articles = await api.recommended()
      return { card: articles, 'card > :slot(badge)': articles.map(article => article.category) }
    },
  },
}

/** The page, created per request from the current templates — creating a page is cheap, the cache lives in the instance. */
export async function homePage() {
  const { version, templates } = await loadTemplates(file)

  return ui.page<Ctx>({
    sections: ({ device }) =>
      Object.entries(templates).map(([key, block]) =>
        // the mobile variant: one column, three cards — applied to any section that has a grid
        ui.section(key, block, {
          ...sectionOptions[key],
          ...(device === 'mobile' && { patch: { grid: { columns: 1 } }, remove: 'card:nth-child(n+4)' }),
        })
      ),
    data: async () => {
      const articles = await api.latest(6)
      return {
        hero: {
          hero: [{ heading: 'Dedal × Web Components', lead: 'Edit templates/home.json and reload — the layout changes, the code doesn\'t.' }],
          'hero > :slot(actions)': [
            { label: 'Desktop layout', href: '?device=desktop' },
            { label: 'Mobile layout', href: '?device=mobile' },
          ],
        },
        news: {
          card: articles,
          'card > :slot(badge)': articles.map(article => article.category),
        },
      }
    },
    // the template version in the key: a new version is served on the next request
    cache: { key: ctx => ['home', version, ctx.device] },
  })
}
