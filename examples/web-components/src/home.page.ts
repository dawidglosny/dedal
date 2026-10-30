import { api } from './api'
import type { Ctx } from './contract'
import { loadTemplates } from './templates'
import { ui } from './ui'

// the layout is data, not code: a JSON file here, a database or a design-tool export in a real project
const templates = loadTemplates(new URL('../templates/home.json', import.meta.url))

export const home = ui.page<Ctx>({
  sections: ({ device }) => [
    ui.section('hero', templates.hero),
    ui.section('news', templates.news, device === 'mobile' ? { patch: { grid: { columns: 1 } }, remove: 'card:nth-child(n+4)' } : {}),
  ],
  data: async () => {
    const articles = await api.latest(6)
    return {
      hero: {
        hero: [{ heading: 'Dedal × Web Components', lead: 'A JSON template, data from an API, custom elements in the browser.' }],
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
  cache: { key: ctx => ['home', ctx.device] },
})
