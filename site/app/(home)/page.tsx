import Link from 'next/link'
import { Code } from '@/components/docs-code'
import { LogoMark } from '@/components/logo'
import { GITHUB, VERSION } from '@/lib/site'

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
  ['Structure is data', 'Templates are plain JSON — store them, version them, pull them from Figma with `dedal-figma`. Rearranging a screen doesn’t change code.'],
  ['One contract, two checks', 'Components, props and slots — typed at compile time, validated at runtime (templates from storage or Figma), exported to JSON Schema for a page builder.'],
  ['Data placed by selectors', '`card`, `#featured`, `card > :slot(badge)` — CSS syntax instead of indexes. Adding a heading doesn’t shift the data.'],
  ['Explicit rules for missing data', 'Fewer items than places, a failing API, an empty section: safe defaults, a strict mode, and a report of everything dropped.'],
  ['Variants without copies', '`patch` and `remove` adapt one template per device, site or experiment.'],
  ['Speed', 'Page and data cache with stale-while-revalidate, parallel loaders, streaming. A 530-node page builds in under a millisecond.'],
  ['Devtools', 'Click any element and see where each prop came from, which selector placed the data and what went missing.'],
  ['A bonus: no lock-in', 'The page is plain JSON and only the registry knows your components — switch libraries without touching pages.'],
]

const before = `// the structure lives in component code:
// every rearrangement is a code change and a release
<Grid columns={3}>
  <Card title={a.title} badge={<Badge label={a.category} />} />
  <Card title={b.title} badge={<Badge label={b.category} />} />
  <Card title={c.title} badge={<Badge label={c.category} />} />
</Grid>`

const after = `{ "component": "grid", "props": { "columns": 3 },
  "children": [
    { "component": "card", "repeat": 3,
      "slots": { "badge": { "component": "badge" } } }
  ] }`

const pullOutput = `$ dedal-figma pull "https://www.figma.com/design/…?node-id=31-398" --mapping ./figma.mapping.mjs --out templates/home.json --images public/figma
1 layer(s) not in the template:
  Frame 427/Group 12/icon/lock-open — an instance of "icon/lock-open", which no contract component maps
3 image(s) → public/figma
✓ 10 section(s) → templates/home.json`

const axes = [
  ['Structure', 'Which blocks, in what order, what goes inside what.', 'Designers, editors, experiments, other systems'],
  ['Data', 'What’s in the blocks.', 'Your APIs, databases, the user'],
  ['Components', 'What a “card” or a “button” looks like and does.', 'The UI team, a component library'],
]

const compare = [
  ['React Server Components', 'Where React runs — on the server, with less JavaScript.', 'Complementary: a Server Component can render a Dedal page. RSC doesn’t say where the structure comes from.'],
  ['Web Components', 'Sharing components across apps and frameworks.', 'A different problem: Dedal doesn’t ship components. Custom elements can be its registry.'],
  ['Headless CMS, page builders', 'Editing content, sometimes layouts, in a UI.', 'A source of templates and data. Dedal is the typed engine in between; it has no editor.'],
  ['Hand-made JSON + a switch', 'The same idea, done ad hoc.', 'What Dedal replaces — data binding, missing-data rules, cache and devtools included.'],
]

const inline = (text: string) => text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part))

const button = 'inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent'
const primary = 'inline-flex items-center rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90'
const card = 'rounded-xl border bg-fd-card p-5'

function Section({ title, lead, children, className = '' }: { title: string; lead?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-6 py-14 ${className}`}>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      {lead && <p className="mt-3 max-w-3xl text-fd-muted-foreground">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  )
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col [&_code]:rounded [&_code]:bg-fd-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-20 pb-10 text-center">
        <LogoMark size={88} />
        <div className="mt-6 rounded-full border px-3 py-1 text-xs text-fd-muted-foreground">v{VERSION} · TypeScript · zero dependencies</div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
          Change screens
          <br />
          <span className="text-fd-primary">without changing code.</span>
        </h1>
        <p className="mt-6 text-lg font-medium md:text-xl">The engine behind pages generated from Figma or a page builder — rendered with your own design system.</p>
        <p className="mt-4 max-w-2xl text-fd-muted-foreground">
          A server-driven UI engine for TypeScript. Structure, data and components are kept apart: the structure of a page lives as data, so it can change
          without a code change or a release — while your components and your APIs stay exactly as they are.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/docs/quick-start/" className={primary}>
            Quick start
          </Link>
          <Link href="/docs/" className={button}>
            Why Dedal
          </Link>
          <Link href="/docs/tutorial/" className={button}>
            Tutorial
          </Link>
          <a href={GITHUB} className={button}>
            GitHub
          </a>
        </div>
        <div className="mt-8 w-full max-w-md text-left">
          <Code code={`npm i github:dawidglosny/dedal#v${VERSION}`} lang="bash" />
        </div>
      </section>

      <Section
        title="From Figma to a page"
        lead="Designers build the page from your design system’s components. One command turns the frame into a template checked against the contract; your components render it. Change the frame, pull again — the page follows, no release."
      >
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ['Design', 'Sections and components from the library, content in native Figma slots — no naming tricks.'],
            ['Pull', '`dedal-figma pull` (or an agent through `dedal-mcp`): converted, validated, every layer left out reported with its path.'],
            ['Render', 'The template is plain JSON; the registry maps its names to your React components.'],
          ].map(([title, text], i) => (
            <li key={title} className={card}>
              <div className="flex size-7 items-center justify-center rounded-full bg-fd-primary text-sm font-semibold text-fd-primary-foreground">{i + 1}</div>
              <div className="mt-3 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-fd-muted-foreground">{inline(text)}</div>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Code code={pullOutput} lang="bash" title="npm run pull" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/figma-demo/" className={primary}>
            A page from Figma, end to end
          </Link>
          <a href={`${GITHUB}/tree/main/examples/figma`} className={button}>
            examples/figma
          </a>
        </div>
      </Section>

      <Section
        title="Three things that usually live in one place"
        lead="A screen built from components mixes three things that change at different times, for different reasons, by different people. When the structure lives in component code, every rearrangement waits for a developer and a release."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {axes.map(([title, what, who]) => (
            <div key={title} className={card}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-fd-muted-foreground">{what}</p>
              <div className="mt-4 border-t pt-3 text-xs text-fd-muted-foreground">Changed by: {who}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Before and after">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium text-fd-muted-foreground">Without Dedal — structure in code</div>
            <Code code={before} lang="tsx" />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-fd-primary">With Dedal — structure as data</div>
            <Code code={after} lang="json" />
            <p className="mt-3 text-sm text-fd-muted-foreground">
              Stored, versioned, edited without a release. Data reaches the cards by a selector (<code>card</code>), and your own <code>&lt;Card&gt;</code> renders
              them.
            </p>
          </div>
        </div>
      </Section>

      <Section title="How it works">
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            ['Structure', 'a JSON template — in code, in a database, from Figma'],
            ['+ Data', 'from your APIs, attached by CSS-like selectors'],
            ['Screen description', 'plain JSON — cached, sent over the network'],
            ['Components', 'the frontend’s registry: name → component'],
          ].map(([title, text], i) => (
            <li key={title} className={card}>
              <div className="flex size-7 items-center justify-center rounded-full bg-fd-primary text-sm font-semibold text-fd-primary-foreground">{i + 1}</div>
              <div className="mt-3 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-fd-muted-foreground">{text}</div>
            </li>
          ))}
        </ol>
      </Section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Who it is for</h2>
          <p className="mt-3 text-fd-muted-foreground">Web products on a shared design system, whose pages are designed in Figma or assembled in a page builder — not written in JSX.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
            <li>Pages from Figma — design with the design system’s components, publish, get a template.</li>
            <li>Page builders and CMSs — Dedal is the engine; the contract says what the editor can place.</li>
            <li>Many products, one design system — templates designed once, served to all.</li>
            <li>Content sites, dashboards, store pages — any structure that changes more often than its components.</li>
          </ul>
          <p className="mt-4 text-sm text-fd-muted-foreground">Later: mobile apps — no native renderer and no contract versioning yet.</p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">When it doesn’t</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
            <li>Application UI — forms, state and interactions rather than blocks from a known set.</li>
            <li>A structure owned by developers that rarely changes — plain components are simpler.</li>
            <li>Sharing a component library across frameworks — that’s what Web Components are for. Dedal composes pages from the components you have; it doesn’t distribute them.</li>
          </ul>
        </div>
      </section>

      <Section
        title="How it compares"
        lead={
          <>
            Dedal decides <strong>what</strong> is on the screen; your framework and components decide <strong>how</strong> it looks and behaves.
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {compare.map(([title, solves, relation]) => (
            <div key={title} className={card}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm font-medium text-fd-muted-foreground">{solves}</p>
              <p className="mt-2 text-sm">{relation}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="A quick look">
        <div className="grid gap-4 lg:grid-cols-3">
          <Code code={contract} title="contract.ts" />
          <Code code={server} title="server" />
          <Code code={frontend} lang="tsx" title="frontend (React)" />
        </div>
      </Section>

      <Section title="What you get">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, text]) => (
            <div key={title} className={card}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-fd-muted-foreground">{inline(text)}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto my-14 w-full max-w-4xl rounded-2xl border bg-fd-card px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Learn by example</h2>
        <p className="mx-auto mt-3 max-w-2xl text-fd-muted-foreground">
          Every feature, warning and error is a live page: its code, the rendered result and the devtools report. Open the panel on any page and click around.
        </p>
        <Link href="/docs/" className={`${primary} mt-6`}>
          Read the docs
        </Link>
      </section>

      <footer className="border-t py-8 text-center text-sm text-fd-muted-foreground">
        <a href={GITHUB} className="hover:text-fd-foreground">
          GitHub
        </a>{' '}
        ·{' '}
        <a href={`${GITHUB}/blob/main/CHANGELOG.md`} className="hover:text-fd-foreground">
          Changelog
        </a>
      </footer>
    </main>
  )
}
