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
    description: 'Czym jest Dedal, jak płyną data, słownik pojęć, pierwsze kroki.',
    intro: intros.introduction,
    file: '',
    cases: [],
  },
  {
    slug: 'tutorial',
    title: 'Tutorial',
    description: 'Krok po kroku: strona główna serwisu od contract do devtools.',
    intro: intros.tutorial,
    file: 'tutorial.cases.ts',
    cases: tutorialCases,
  },
  {
    slug: 'layout',
    intro: intros.layout,
    title: 'Layout',
    description: 'Bloki, sloty, aliasy, patch i remove — struktura section, zanim dostanie data.',
    file: 'layout.cases.ts',
    cases: layoutCases,
  },
  {
    slug: 'data',
    intro: intros.data,
    title: 'Data',
    description: 'Bindings: jak data trafiają do node, co przy brakach i nadmiarze.',
    file: 'data.cases.ts',
    cases: dataCases,
  },
  {
    slug: 'sections',
    intro: intros.sections,
    title: 'Sections',
    description: 'Loadery, section opcjonalne, puste, odroczone.',
    file: 'sections.cases.ts',
    cases: sectionCases,
  },
  {
    slug: 'cache',
    intro: intros.cache,
    title: 'Cache & queries',
    description: 'Cache strony, query i ich statusy, invalidate.',
    file: 'cache.cases.ts',
    cases: cacheCases,
  },
  {
    slug: 'rendering',
    intro: intros.rendering,
    title: 'Rendering',
    description: 'Registry, toProps i problemy resolve (issues).',
    file: 'rendering.cases.ts',
    cases: renderingCases,
  },
  {
    slug: 'errors',
    intro: intros.errors,
    title: 'Errors (thrown)',
    description: 'Wyjątki przerywające build albo resolve — z treścią komunikatu.',
    file: 'errors.cases.ts',
    cases: errorCases,
  },
  {
    slug: 'devtools',
    intro: intros.devtools,
    title: 'Devtools',
    description: 'Panel, timing, build bez trace.',
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
