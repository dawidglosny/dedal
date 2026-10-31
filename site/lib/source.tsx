import { docs } from 'fumadocs-mdx:collections/server'
import { getSlugs, loader, type MetaData, type PageData, type StaticSource, type VirtualFile } from 'fumadocs-core/source'
import type { StructuredData } from 'fumadocs-core/mdx-plugins/remark-structure'
import { groups, parts } from '@/ui/docs'
import { live } from '@/ui/docs/live'
import type { CaseLevel } from '@/ui/docs/types'

/**
 * The docs content source: one loader over two sources.
 *
 * - `mdx` — pages written as MDX in `content/docs` (fumadocs-mdx).
 * - `ts` — virtual pages built from the TypeScript docs data (`ui/docs`): every group not converted to MDX yet, and every case.
 *
 * Every page keeps a flat URL, `/docs/<slug>/`: a case lives in its group's folder (so the sidebar nests it), but its
 * slugs are set explicitly to `[case slug]`. Converting a group to MDX = adding `content/docs/<slug>.mdx`
 * (or `content/docs/<slug>/index.mdx` for a group with cases); the virtual page for that slug is then skipped.
 */

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Search data of a markdown-like prose text: `## ` / `### ` headings, the plain text of the rest (code blocks dropped). */
function structure(text: string): StructuredData {
  const data: StructuredData = { headings: [], contents: [] }
  let heading: string | undefined
  let fenced = false
  for (const block of text.split(/\n{2,}/)) {
    const fences = (block.match(/^```/gm) ?? []).length
    const wasFenced = fenced
    if (fences % 2) fenced = !fenced
    if (wasFenced || fences) continue
    const match = /^#{2,3} (.*)/.exec(block)
    if (match) {
      heading = slugify(match[1])
      data.headings.push({ id: heading, content: match[1].replace(/[`*]/g, '') })
      continue
    }
    const content = block.replace(/[`*]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
    if (content) data.contents.push({ heading, content })
  }
  return data
}

/** Data of a virtual page: what the page route needs to find the TS data again. */
export type TsPageData = PageData & { kind: 'group' | 'case'; slug: string; structuredData: StructuredData }

const mdx = docs.toFumadocsSource()
// slugs that have an MDX page — their virtual page is skipped
const mdxSlugs = new Set(mdx.files.filter(file => file.type === 'page').map(file => getSlugs(file.path).join('/')))

const levelIcon = (level: CaseLevel) => `level:${level}`

function tsFiles(): VirtualFile<{ pageData: TsPageData; metaData: MetaData }>[] {
  const files: VirtualFile<{ pageData: TsPageData; metaData: MetaData }>[] = [
    {
      type: 'meta',
      path: 'meta.json',
      // part titles as separators, then the groups of the part (a folder for a group with cases, a page otherwise)
      data: { pages: parts.flatMap(part => [`---${part.title}---`, ...part.groups]) },
    },
  ]
  for (const group of groups) {
    const dir = group.cases.length ? `${group.slug}/` : ''
    if (dir) files.push({ type: 'meta', path: `${dir}meta.json`, data: { title: group.title, pages: group.cases.map(docCase => docCase.slug) } })
    if (!mdxSlugs.has(group.slug))
      files.push({
        type: 'page',
        path: dir ? `${dir}index.ts` : `${group.slug}.ts`,
        slugs: [group.slug],
        data: { kind: 'group', slug: group.slug, title: group.title, description: group.description, structuredData: structure(`${group.description}\n\n${group.intro}`) },
      })
    for (const docCase of group.cases) {
      if (mdxSlugs.has(docCase.slug)) continue
      files.push({
        type: 'page',
        path: `${dir}${docCase.slug}.ts`,
        slugs: [docCase.slug],
        data: {
          kind: 'case',
          slug: docCase.slug,
          title: docCase.title,
          description: group.title,
          icon: levelIcon(docCase.level),
          structuredData: structure(`${docCase.description}\n\n${live[docCase.slug] ?? ''}`),
        },
      })
    }
  }
  return files
}

const ts: StaticSource<{ pageData: TsPageData; metaData: MetaData }> = { files: tsFiles() }

export const source = loader({
  baseUrl: '/docs',
  source: { mdx, ts },
  // a case's status as the sidebar icon: a colored dot
  icon: icon => (icon?.startsWith('level:') ? <span className={`dot ${icon.slice('level:'.length)}`} /> : undefined),
})

export type DocsPage = (typeof source)['$inferPage']
