import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cacheCases } from './cache.cases'
import { dashboardCases } from './dashboard.cases'
import { dataCases } from './data.cases'
import { devtoolsCases } from './devtools.cases'
import { errorCases } from './errors.cases'
import { layoutCases } from './layout.cases'
import { productionCases } from './production.cases'
import { renderingCases } from './rendering.cases'
import { sectionCases } from './sections.cases'
import { tutorialCases } from './tutorial.cases'
import type { DocCase, DocGroup } from './types'

/** Documentation groups in menu order; `file` — the group file whose `#region`s are shown as code. */
/** The API reference is `docs/API.md` in the repository — one source for GitHub and the site (its `# ` title dropped). */
const apiReference = readFileSync(join(process.cwd(), '../docs/API.md'), 'utf8').replace(/^# .*\n+/, '')

export const groups: DocGroup[] = [
  {
    slug: 'why',
    title: 'Why Dedal',
    description: 'Structure, data and components kept apart: why, who it is for and who it isn\'t, how it compares.',
    file: '',
    cases: [],
  },
  {
    slug: 'quick-start',
    title: 'Quick start',
    description: 'Install, a contract, a page, a registry — and a rendered page in five files.',
    file: '',
    cases: [],
  },
  {
    slug: 'introduction',
    title: 'Introduction',
    description: 'How Dedal works: roles, data flow, an example step by step, a glossary.',
    file: '',
    cases: [],
  },
  {
    slug: 'tutorial',
    title: 'Tutorial',
    description: 'Seven steps: a home page from the contract to a template edited without a release, then a debugging exercise.',
    file: 'tutorial.cases.ts',
    cases: tutorialCases,
  },
  {
    slug: 'dashboard',
    title: 'Another domain: a dashboard',
    description: 'The same engine on a different contract: widgets per role, layouts saved per customer, a failing data source.',
    file: 'dashboard.cases.ts',
    cases: dashboardCases,
  },
  {
    slug: 'production',
    title: 'Going to production',
    description: 'Shared sections with their own loaders, streaming of slow sections, queries and page cache.',
    file: 'production.cases.ts',
    cases: productionCases,
  },
  {
    slug: 'templates-in-storage',
    title: 'Templates in a database or CMS',
    description: 'Stored templates in a real project: the contract as a value, validation, caching, preview, publishing, CI.',
    file: '',
    cases: [],
  },
  {
    slug: 'templates-from-figma',
    title: 'Templates from Figma',
    description: 'dedal/figma and dedal-figma pull: component properties, native slots and text styles mapped to the contract; what didn\'t fit, reported.',
    file: '',
    cases: [],
  },
  {
    slug: 'figma-demo',
    title: 'A page from Figma, end to end',
    description: 'The demo: a landing page designed in Figma, pulled by dedal-figma and rendered by Dedal — every file, the loop, what the contract stops.',
    file: '',
    cases: [],
  },
  {
    slug: 'adopting',
    title: 'Adopting in an existing app',
    description: 'One block first, your components kept, a registry as an adapter — grow from there, or stop.',
    file: '',
    cases: [],
  },
  {
    slug: 'clients-without-react',
    title: 'A client without React',
    description: 'The page format, a renderer in a few dozen lines, older mobile apps, types on the client.',
    file: '',
    cases: [],
  },
  {
    slug: 'testing',
    title: 'Testing',
    description: 'Pages, the registry and toProps in tests: build reports, resolve issues, devtools messages, snapshots.',
    file: '',
    cases: [],
  },
  {
    slug: 'layout',
    title: 'Layout',
    description: 'Blocks, slots, aliases, patch and remove — the structure of a section before it gets data.',
    file: 'layout.cases.ts',
    cases: layoutCases,
  },
  {
    slug: 'data',
    title: 'Data',
    description: 'Bindings: how data reaches nodes, and what happens on shortage and surplus.',
    file: 'data.cases.ts',
    cases: dataCases,
  },
  {
    slug: 'sections',
    title: 'Sections',
    description: 'Loaders; optional, empty and deferred sections.',
    file: 'sections.cases.ts',
    cases: sectionCases,
  },
  {
    slug: 'cache',
    title: 'Cache & queries',
    description: 'Page cache, queries and their statuses, invalidate.',
    file: 'cache.cases.ts',
    cases: cacheCases,
  },
  {
    slug: 'rendering',
    title: 'Rendering',
    description: 'Registry, toProps and resolve problems (issues).',
    file: 'rendering.cases.ts',
    cases: renderingCases,
  },
  {
    slug: 'errors',
    title: 'Errors (thrown)',
    description: 'Exceptions that abort build or resolve — with the message text.',
    file: 'errors.cases.ts',
    cases: errorCases,
  },
  {
    slug: 'devtools',
    title: 'Devtools',
    description: 'The panel, timing, building without trace.',
    file: 'devtools.cases.ts',
    cases: devtoolsCases,
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    description: 'Every term used in these docs, in one place.',
    file: '',
    cases: [],
  },
  {
    slug: 'limitations',
    title: 'Limitations',
    description: 'What Dedal doesn\'t do — or doesn\'t do yet.',
    file: '',
    cases: [],
  },
  {
    slug: 'api',
    title: 'API reference',
    description: 'Formats, design rules and every option of the package.',
    intro: apiReference,
    source: 'docs/API.md',
    file: '',
    cases: [],
  },
]

/** Parts of the menu: groups in the order of a reader's needs — first steps, learning, features, when something's wrong. */
export const parts: { title: string; groups: string[] }[] = [
  { title: 'Get started', groups: ['why', 'quick-start', 'introduction'] },
  { title: 'Learn', groups: ['tutorial', 'dashboard', 'production'] },
  { title: 'Guides', groups: ['templates-in-storage', 'templates-from-figma', 'figma-demo', 'adopting', 'clients-without-react', 'testing'] },
  { title: 'Features', groups: ['layout', 'data', 'sections', 'cache', 'rendering'] },
  { title: 'Troubleshooting', groups: ['errors', 'devtools'] },
  { title: 'Reference', groups: ['api', 'glossary', 'limitations'] },
]

export const allCases = groups.flatMap(group => group.cases.map(docCase => ({ group, docCase })))

export const findCase = (slug: string): { group: DocGroup; docCase: DocCase } | undefined =>
  allCases.find(({ docCase }) => docCase.slug === slug)

export const findGroup = (slug: string): DocGroup | undefined => groups.find(group => group.slug === slug)

