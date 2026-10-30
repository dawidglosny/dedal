import { notFound } from 'next/navigation'
import { findCase, findGroup, groups } from '@/ui/docs'
import { DocView, GroupView } from '@/ui/docs/doc-view'

// cases build on every request — timings, cache statuses and thrown errors as they really happen
export const dynamic = 'force-dynamic'

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const key = slug?.[0] ?? groups[0].slug
  const group = findGroup(key)
  if (group) return <GroupView group={group} />
  const found = findCase(key)
  if (!found) notFound()
  return <DocView group={found.group} docCase={found.docCase} />
}
