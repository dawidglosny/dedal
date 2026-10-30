import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { allCases, findCase, findGroup, groups } from '@/ui/docs'
import { DocView, GroupView } from '@/ui/docs/doc-view'

// every group and case page is generated at build time — the cases run once, and their devtools payloads are in the HTML
export const dynamicParams = false

export function generateStaticParams() {
  return [{ slug: [] }, ...groups.map(group => ({ slug: [group.slug] })), ...allCases.map(({ docCase }) => ({ slug: [docCase.slug] }))]
}

const lookup = (slug?: string[]) => {
  const key = slug?.[0] ?? groups[0].slug
  const group = findGroup(key)
  return group ? { group } : findCase(key)
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const found = lookup((await params).slug)
  if (!found) return {}
  return 'docCase' in found ? { title: found.docCase.title, description: found.group.description } : { title: found.group.title, description: found.group.description }
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const found = lookup((await params).slug)
  if (!found) notFound()
  return 'docCase' in found ? <DocView group={found.group} docCase={found.docCase} /> : <GroupView group={found.group} />
}
