// Checks every link of the exported site (run after `npm run build`): internal pages and anchors, the site's
// own absolute URLs, files of this repository on GitHub. TypeDoc pages (built separately) and the demo data's
// article links inside live examples are skipped. Usage: node scripts/check-links.mjs [out] [repo root]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const [out = 'out', repo = '..'] = process.argv.slice(2)
const files = []
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p) } }
walk(out); files.splice(0, files.length, ...files.filter(f => !f.includes('/types/')))
const ids = new Map()
const idsOf = file => { if (!ids.has(file)) { const html = existsSync(file) ? readFileSync(file, 'utf8') : ''; ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))) } return ids.get(file) }
const pageFile = path => { const clean = decodeURIComponent(path.split('?')[0]); const candidates = [join(out, clean), join(out, clean, 'index.html'), join(out, clean + '.html')]; return candidates.find(c => existsSync(c) && statSync(c).isFile()) }
const problems = new Map(); let checked = 0
const report = (link, from, why) => { const key = `${link} — ${why}`; if (!problems.has(key)) problems.set(key, new Set()); problems.get(key).add(from.slice(out.length)) }
for (const file of files) {
  const html = readFileSync(file, 'utf8')
  for (const [, link] of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = link.replace(/&amp;/g, '&')
    if (/^(mailto:|javascript:)/.test(href) || href.startsWith('/_next/') || href.startsWith('/article/')) continue
    checked++
    let path = href, hash = ''
    const site = 'https://dawidglosny.github.io/dedal'
    if (href.startsWith(site)) path = href.slice(site.length) || '/'
    else if (href.startsWith('https://github.com/dawidglosny/dedal/blob/main/')) { const local = href.slice('https://github.com/dawidglosny/dedal/blob/main/'.length).split('#')[0]; if (!existsSync(join(repo, local))) report(href, file, 'repo file missing'); continue }
    else if (href.startsWith('https://github.com/dawidglosny/dedal/tree/main/')) { const local = href.slice('https://github.com/dawidglosny/dedal/tree/main/'.length); if (!existsSync(join(repo, local))) report(href, file, 'repo dir missing'); continue }
    else if (/^https?:/.test(href)) continue
    if (path.startsWith('#')) { if (!idsOf(file).has(decodeURIComponent(path.slice(1)))) report(href, file, 'anchor missing'); continue }
    ;[path, hash] = path.split('#')
    if (path.startsWith('/types/')) { if (!existsSync(join(repo, 'site/out', path)) && !existsSync(join(repo, 'docs-types', path))) report(href, file, 'TypeDoc (built separately)'); continue }
    const target = pageFile(path)
    if (!target) { report(href, file, 'page missing'); continue }
    if (hash && !idsOf(target).has(decodeURIComponent(hash))) report(href, file, 'anchor missing')
  }
}
console.log(`${files.length} pages, ${checked} links checked, ${problems.size} problems`)
if (problems.size) process.exitCode = 1
for (const [problem, from] of problems) console.log(`- ${problem}  (${from.size} page(s), e.g. ${[...from][0]})`)
