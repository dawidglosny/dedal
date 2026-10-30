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
  'Przykładowy artykuł numer jeden',
  'Mock: nagłówek testowy',
  'Lorem ipsum dolor sit amet',
  'Testowy tekst o średniej długości tytułu',
  'Krótki tytuł',
  'Bardzo długi tytuł testowy, który sprawdza zawijanie w kartach',
  'Artykuł demonstracyjny',
  'Kolejna pozycja z mocka',
  'Nagłówek do testów układu',
  'Treść zastępcza',
  'Element listy numer jedenaście',
  'Ostatni artykuł z mocka',
]

const categories = ['Kategoria A', 'Kategoria B', 'Kategoria C']
const authors: Author[] = [{ name: 'Anna Testowa' }, { name: 'Jan Mockowy' }, { name: 'Ewa Przykładowa' }]

export async function fetchArticles(count: number): Promise<Article[]> {
  await new Promise(resolve => setTimeout(resolve, 20))

  return headlines.slice(0, count).map((headline, i) => ({
    id: i + 1,
    headline,
    excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Krótki lead artykułu z mocka.',
    slug: `artykul-${i + 1}`,
    category: categories[i % categories.length],
    cover: `cover-${i + 1}`,
    author: authors[i % authors.length],
  }))
}
