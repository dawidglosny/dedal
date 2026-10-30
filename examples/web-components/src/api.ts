/** A mocked content API — in a real project: a CMS, a database, an HTTP client. */
export type Article = { headline: string; slug: string; category: string }

const articles: Article[] = [
  { headline: 'Night trains are coming back', slug: 'night-trains', category: 'Travel' },
  { headline: 'A quiet year for comets', slug: 'comets', category: 'Science' },
  { headline: 'The city that plants a tree per child', slug: 'trees', category: 'Cities' },
  { headline: 'Why bread rises', slug: 'bread', category: 'Food' },
  { headline: 'Five rivers worth a kayak', slug: 'rivers', category: 'Travel' },
  { headline: 'How bridges are tested', slug: 'bridges', category: 'Engineering' },
]

export const api = {
  latest: async (count: number): Promise<Article[]> => articles.slice(0, count),
}
