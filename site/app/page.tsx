import Link from 'next/link'
import { Code } from '@/components/code'
import { GITHUB, VERSION } from '@/components/header'
import { LogoMark } from '@/components/logo'

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
  ['Structure is data', 'Templates are plain JSON — store them, version them, generate them from a design tool. Rearranging a screen doesn’t change code.'],
  ['One typed contract', 'A TypeScript type of components and props, shared by the server and every frontend. Registries are checked at compile time.'],
  ['Data placed by selectors', '`card`, `#featured`, `card > :slot(badge)` — CSS syntax instead of indexes. Adding a heading doesn’t shift the data.'],
  ['Explicit rules for missing data', 'Fewer items than places, a failing API, an empty section: safe defaults, a strict mode, and a report of everything dropped.'],
  ['Variants without copies', '`patch` and `remove` adapt one template per device, site or experiment.'],
  ['Speed', 'Page and data cache with stale-while-revalidate, parallel loaders, streaming. A 530-node page builds in under a millisecond.'],
  ['Devtools', 'Click any element and see where each prop came from, which selector placed the data and what went missing.'],
  ['A bonus: no lock-in', 'The page is plain JSON and only the registry knows your components — switch libraries without touching pages.'],
]

const inline = (text: string) => text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part))

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <LogoMark size={96} className="hero-logo" />
        <div className="hero-badge">v{VERSION} · TypeScript · zero dependencies</div>
        <h1>
          Structure, data and components.
          <br />
          <span>Kept apart, joined at the last moment.</span>
        </h1>
        <p className="hero-lead">
          Dedal is a server-driven UI engine for TypeScript. The structure of a screen is a JSON template, data is attached to it by CSS-like selectors, and the
          frontend renders the result with its own components — so each of the three can change on its own schedule, by different people.
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
          ['Structure', 'a JSON template — in code, in a database, from a design tool'],
          ['+ Data', 'from your APIs, attached by CSS-like selectors'],
          ['Screen description', 'plain JSON — cached, sent over the network'],
          ['Components', 'the frontend’s registry: name → component'],
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
          <h2>Who it is for</h2>
          <p className="fit-lead">Any UI whose structure changes on a different schedule, by different people, or comes from a different system than its components.</p>
          <ul>
            <li>Mobile apps — a new screen layout without a store release.</li>
            <li>Content sites and landing pages — sections rearranged every day.</li>
            <li>Dashboards — which widgets, in what order, per role or customer.</li>
            <li>Onboarding and flows — steps tuned by product, not by code.</li>
            <li>Stores — campaign pages, A/B tests of the page structure.</li>
            <li>One design system, many products — templates designed once, served to all.</li>
          </ul>
        </div>
        <div>
          <h2>When it doesn’t</h2>
          <ul>
            <li>Application UI — forms, state and interactions rather than blocks from a known set.</li>
            <li>A structure owned by developers that rarely changes — plain components are simpler.</li>
            <li>Sharing a component library across frameworks — that’s what Web Components are for. Dedal composes pages from the components you have; it doesn’t distribute them.</li>
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
