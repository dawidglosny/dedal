import type { SearchEntry } from '@/components/search'
import { groups } from '@/ui/docs'
import { live } from '@/ui/docs/live'

export const dynamic = 'force-static'

/** Plain text of a docs prose: no code blocks, no markup. */
const plain = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function GET() {
  const entries: SearchEntry[] = groups.flatMap(group => [
    { href: `/docs/${group.slug}/`, title: group.title, group: 'Documentation', text: plain(`${group.description} ${group.intro ?? ''}`) },
    ...group.cases.map(docCase => ({
      href: `/docs/${docCase.slug}/`,
      title: docCase.title,
      group: group.title,
      text: plain(`${docCase.description} ${live[docCase.slug] ?? ''}`),
    })),
  ])
  return Response.json(entries)
}
