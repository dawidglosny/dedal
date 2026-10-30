/** Mock data source — stands in for a CMS / API. */
export type Author = { name: string }

export type Article = {
  id: number
  headline: string
  excerpt: string
  slug: string
  category: string
  cover: string
  author: Author
}

const headlines = [
  'Sample article number one',
  'Mock: test headline',
  'Lorem ipsum dolor sit amet',
  'Test text with a medium-length title',
  'Short title',
  'A very long test title that checks text wrapping in cards',
  'Demo article',
  'Another mock item',
  'Headline for layout tests',
  'Placeholder content',
  'List item number eleven',
  'Last mock article',
]

const categories = ['Category A', 'Category B', 'Category C']
const authors: Author[] = [{ name: 'Anna Test' }, { name: 'John Mock' }, { name: 'Eve Sample' }]

export async function fetchArticles(count: number): Promise<Article[]> {
  await new Promise(resolve => setTimeout(resolve, 20))

  return headlines.slice(0, count).map((headline, i) => ({
    id: i + 1,
    headline,
    excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. A short lead of a mock article.',
    slug: `article-${i + 1}`,
    category: categories[i % categories.length],
    cover: `cover-${i + 1}`,
    author: authors[i % authors.length],
  }))
}
