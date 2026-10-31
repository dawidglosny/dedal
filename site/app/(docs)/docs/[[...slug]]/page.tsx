import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import type { TOCItemType } from 'fumadocs-core/toc'
import { source } from '@/lib/source'
import { findCase, findGroup, groups } from '@/ui/docs'
import { Badge, caseContent, editPath, groupContent, Inline } from '@/ui/docs/doc-view'

// every group and case page is generated at build time — the cases run once, and their devtools payloads are in the HTML
export const dynamicParams = false

export function generateStaticParams() {
  return [{ slug: [] }, ...source.generateParams()]
}

// `/docs/` shows the first group
const lookup = (slug?: string[]) => source.getPage(slug?.length ? slug : [groups[0].slug])

const github = { owner: 'dawidglosny', repo: 'dedal', sha: 'main' }

const toToc = (items: { id: string; title: string; level?: number }[]): TOCItemType[] =>
  items.map(item => ({ title: <Inline text={item.title} />, url: `#${item.id}`, depth: item.level ?? 2 }))

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const page = lookup((await params).slug)
  return page ? { title: page.data.title, description: page.data.description } : {}
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const page = lookup((await params).slug)
  if (!page) notFound()

  // a page written in MDX
  if (page.type === 'mdx') {
    const MDX = page.data.body
    return (
      <DocsPage toc={page.data.toc} editOnGithub={{ ...github, path: `site/content/docs/${page.path}` }}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX components={defaultMdxComponents} />
        </DocsBody>
      </DocsPage>
    )
  }

  // a case: its group's data, the live result, the devtools report
  if (page.data.kind === 'case') {
    const { group, docCase } = findCase(page.data.slug)!
    const { toc, body } = await caseContent(group, docCase)
    return (
      <DocsPage toc={toToc(toc)} editOnGithub={{ ...github, path: editPath(group, docCase) }}>
        <DocsTitle>
          {docCase.title} <Badge level={docCase.level} />
        </DocsTitle>
        <DocsDescription>{group.title}</DocsDescription>
        <DocsBody>{body}</DocsBody>
      </DocsPage>
    )
  }

  // a group page not converted to MDX yet: the intro from ui/docs/intros.ts, rendered by Prose
  const group = findGroup(page.data.slug)!
  const { toc, body } = groupContent(group)
  return (
    <DocsPage toc={toToc(toc)} editOnGithub={{ ...github, path: editPath(group) }}>
      <DocsTitle>{group.title}</DocsTitle>
      <DocsDescription>{group.description}</DocsDescription>
      <DocsBody>{body}</DocsBody>
    </DocsPage>
  )
}
