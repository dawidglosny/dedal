import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

export const dynamic = 'force-static'

const search = createFromSource(source)

/**
 * The static search index (Orama-compatible export, searched in the browser): every page of the loader — MDX pages
 * with their structured data from fumadocs-mdx, virtual group and case pages with theirs from `lib/source.tsx`.
 * Page URLs get their trailing slash (`/docs/data/#binding`), as the static export writes the pages — Fumadocs drops it.
 */
export async function GET() {
  const json = await (await search.staticGET()).text()
  const withSlash = json.replace(/"url":"(\/docs\/[^"#]*?)(\/?)(#[^"]*)?"/g, (_, path: string, _slash: string, hash = '') => `"url":"${path}/${hash}"`)
  return new Response(withSlash, { headers: { 'Content-Type': 'application/json' } })
}
