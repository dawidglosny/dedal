import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

export const dynamic = 'force-static'

/**
 * The static search index (Orama-compatible export, searched in the browser): every page of the loader — MDX pages
 * with their structured data from fumadocs-mdx, virtual group and case pages with theirs from `lib/source.tsx`.
 */
export const { staticGET: GET } = createFromSource(source)
