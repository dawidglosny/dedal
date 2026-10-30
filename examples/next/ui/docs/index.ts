import { cacheCases } from './cache.cases'
import { dataCases } from './data.cases'
import { devtoolsCases } from './devtools.cases'
import { errorCases } from './errors.cases'
import { intros } from './intros'
import { layoutCases } from './layout.cases'
import { renderingCases } from './rendering.cases'
import { sectionCases } from './sections.cases'
import { tutorialCases } from './tutorial.cases'
import type { DocCase, DocGroup } from './types'

/** Documentation groups in menu order; `file` — the group file whose `#region`s are shown as code. */
export const groups: DocGroup[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    description: 'What Dedal is, how data flows, a glossary, first steps.',
    intro: intros.introduction,
    file: '',
    cases: [],
  },
  {
    slug: 'tutorial',
    title: 'Tutorial',
    description: 'Step by step: a site\'s home page, from contract to devtools.',
    intro: intros.tutorial,
    file: 'tutorial.cases.ts',
    cases: tutorialCases,
  },
  {
    slug: 'layout',
    intro: intros.layout,
    title: 'Layout',
    description: 'Blocks, slots, aliases, patch and remove — the structure of a section before it gets data.',
    file: 'layout.cases.ts',
    cases: layoutCases,
  },
  {
    slug: 'data',
    intro: intros.data,
    title: 'Data',
    description: 'Bindings: how data reaches nodes, and what happens on shortage and surplus.',
    file: 'data.cases.ts',
    cases: dataCases,
  },
  {
    slug: 'sections',
    intro: intros.sections,
    title: 'Sections',
    description: 'Loaders; optional, empty and deferred sections.',
    file: 'sections.cases.ts',
    cases: sectionCases,
  },
  {
    slug: 'cache',
    intro: intros.cache,
    title: 'Cache & queries',
    description: 'Page cache, queries and their statuses, invalidate.',
    file: 'cache.cases.ts',
    cases: cacheCases,
  },
  {
    slug: 'rendering',
    intro: intros.rendering,
    title: 'Rendering',
    description: 'Registry, toProps and resolve problems (issues).',
    file: 'rendering.cases.ts',
    cases: renderingCases,
  },
  {
    slug: 'errors',
    intro: intros.errors,
    title: 'Errors (thrown)',
    description: 'Exceptions that abort build or resolve — with the message text.',
    file: 'errors.cases.ts',
    cases: errorCases,
  },
  {
    slug: 'devtools',
    intro: intros.devtools,
    title: 'Devtools',
    description: 'The panel, timing, building without trace.',
    file: 'devtools.cases.ts',
    cases: devtoolsCases,
  },
]

export const allCases = groups.flatMap(group => group.cases.map(docCase => ({ group, docCase })))

export const findCase = (slug: string): { group: DocGroup; docCase: DocCase } | undefined =>
  allCases.find(({ docCase }) => docCase.slug === slug)

export const findGroup = (slug: string): DocGroup | undefined => groups.find(group => group.slug === slug)

/** Reading order: each group page, then its cases. */
export const readingOrder = groups.flatMap(group => [
  { href: `/docs/${group.slug}`, title: group.title, group },
  ...group.cases.map(docCase => ({ href: `/docs/${docCase.slug}`, title: docCase.title, group })),
])
