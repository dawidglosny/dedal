import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'

export const dynamic = 'force-static'

/** Selectors of the document root in Radix Themes' CSS: the preview container stands in for them. */
const rootSelector = /^(:root|html|body)(?=$|[:\[.\s])/

/**
 * Radix Themes' CSS for the live results of the docs, scoped to `.dedal-preview`: every selector is prefixed
 * (`:root` becomes the container itself), so nothing reaches the docs chrome — not the `.dark` class of the dark mode,
 * not the global `[data-accent-color]` / `[data-radius]` tokens. `@keyframes` and `@font-face` stay global (they only
 * define names). Built once at build time, as a static file; the pages with a preview link it (`PreviewStyles`).
 */
export async function GET() {
  // read from disk at build time (the build runs in site/), not bundled
  const file = join(process.cwd(), 'node_modules/@radix-ui/themes/styles.css')
  const root = postcss.parse(readFileSync(file, 'utf8'))
  root.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as postcss.AtRule).name)) return
    rule.selectors = rule.selectors.map(selector =>
      rootSelector.test(selector) ? selector.replace(rootSelector, '.dedal-preview') : `.dedal-preview ${selector}`
    )
  })
  return new Response(root.toString(), { headers: { 'content-type': 'text/css; charset=utf-8' } })
}
