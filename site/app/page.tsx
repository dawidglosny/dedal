import Link from 'next/link'
import { Code } from '@/components/code'
import { GITHUB, VERSION } from '@/components/header'

const contract = `// contract.ts — the only thing the server and every frontend share
import type { Slot } from 'dedal'

export type Contract = {
  grid: { columns?: 1 | 2 | 3 | 4 }
  card: { title?: string; href?: string; badge?: Slot }
  badge: { label?: string }
}`

const server = `// server: a template (usually loaded from storage) + data from your API
const newsTemplate = { component: 'grid', props: { columns: 3 }, children: [
  { component: 'card', repeat: 6, slots: { badge: { component: 'badge' } } },
] } satisfies BlockDefinition<Contract>

const home = ui.page({
  sections: [ui.section('news', newsTemplate)],
  data: async () => {
    const articles = await api.latest(6)
    return { news: {
      card: articles.map(a => ({ title: a.headline, href: a.url })),
      'card > :slot(badge)': articles.map(a => ({ label: a.category })),
    } }
  },
})

const page = ui.resolve(await home.build())   // plain JSON`

const frontend = `// frontend: component names → your components
const registry = { grid: Grid, card: Card, badge: Badge } satisfies Registry<Contract>

<Render tree={page} registry={registry} />`

const features = [
  ['The layout is data', 'Templates are plain JSON — store them, version them, generate them from a design tool. Changing a page doesn’t change code.'],
  ['One typed contract', 'A TypeScript type of components and props, shared by the server and every frontend. Registries are checked at compile time.'],
  ['Data placed by selectors', '`card`, `#featured`, `card > :slot(badge)` — CSS syntax instead of indexes. Adding a heading doesn’t shift the data.'],
  ['Explicit rules for missing data', 'Fewer items than places, a failing API, an empty section: safe defaults, a strict mode, and a report of everything dropped.'],
  ['Variants without copies', '`patch` and `remove` adapt one template per device, site or experiment.'],
  ['Any components, any framework', 'Only the registry knows your components. A zero-dependency core; React included, Web Components in a few lines.'],
  ['Fast', 'Page and data cache with stale-while-revalidate, parallel loaders, streaming. A 530-node page builds in under a millisecond.'],
  ['Devtools', 'Click any element and see where each prop came from, which selector placed the data and what went missing.'],
]

const inline = (text: string) => text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part))

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-badge">v{VERSION} · TypeScript · zero dependencies</div>
        <h1>
          Page layouts as data.
          <br />
          <span>Rendered by any frontend.</span>
        </h1>
        <p className="hero-lead">
          Dedal is a server-driven UI engine. Keep page templates on the server, fill them with content from your APIs, and let each frontend render them with its own
          components — React, Web Components or a mobile app.
        </p>
        <div className="hero-actions">
          <Link href="/docs/" className="button button-primary">
            Why Dedal
          </Link>
          <Link href="/docs/tutorial/" className="button">
            Tutorial
          </Link>
          <a href={GITHUB} className="button">
            GitHub
          </a>
        </div>
        <div className="hero-install">
          <Code code={`npm i github:dawidglosny/dedal#v${VERSION}`} lang="bash" />
        </div>
      </section>

      <section className="flow">
        {[
          ['Template', 'JSON from a design tool, an editor or code'],
          ['+ Data', 'your APIs, placed by CSS-like selectors'],
          ['Page (JSON)', 'cached, sent over the network'],
          ['Render', 'name → component, in any frontend'],
        ].map(([title, text], i) => (
          <div key={title} className="flow-step">
            <div className="flow-number">{i + 1}</div>
            <div className="flow-title">{title}</div>
            <div className="flow-text">{text}</div>
          </div>
        ))}
      </section>

      <section className="landing-section">
        <h2>A quick look</h2>
        <div className="quick">
          <Code code={contract} title="contract.ts" />
          <Code code={server} title="server" />
          <Code code={frontend} lang="tsx" title="frontend (React)" />
        </div>
      </section>

      <section className="landing-section">
        <h2>What you get</h2>
        <div className="features">
          {features.map(([title, text]) => (
            <div key={title} className="feature">
              <h3>{title}</h3>
              <p>{inline(text)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section fit">
        <div>
          <h2>When it fits</h2>
          <ul>
            <li>Layouts change more often than components — editors, designers or experiments rearrange pages.</li>
            <li>Layouts come from outside the code — a design tool, a page editor, a CMS, a database.</li>
            <li>One page, several frontends — web and an app, or many sites on one design system.</li>
            <li>The component library may change — only the registry knows it.</li>
          </ul>
        </div>
        <div>
          <h2>When it doesn’t</h2>
          <ul>
            <li>Application UI — forms, state and interactions rather than content blocks.</li>
            <li>One frontend, a layout owned by developers that rarely changes.</li>
            <li>A small team with everything in one repository — the contract and registry would be overhead.</li>
          </ul>
        </div>
      </section>

      <section className="landing-cta">
        <h2>Learn by example</h2>
        <p>Every feature, warning and error is a live page: its code, the rendered result and the devtools report. Open the panel on any page and click around.</p>
        <Link href="/docs/" className="button button-primary">
          Read the docs
        </Link>
      </section>

      <footer className="footer">
        <a href={GITHUB}>GitHub</a> · <a href={`${GITHUB}/blob/main/CHANGELOG.md`}>Changelog</a>
      </footer>
    </main>
  )
}
