import type { createDedal, Page, PageResult } from 'dedal'
import type { Registry } from 'dedal/react'
import type { Contract, Ctx } from '../contract'

export type Dedal = ReturnType<typeof createDedal<Contract>>

/** What a case produced: the instance (for `resolve`), the build result and — for deferred sections — the page. */
export type CaseOutput = {
  ui: Dedal
  result: PageResult<Contract>
  ctx?: Ctx
  page?: Page<Contract, Ctx>
  /** Changes the result before `resolve` (e.g. data out of sync with the layout). */
  beforeResolve?: (result: PageResult<Contract>) => PageResult<Contract>
  /** `resolve` options, e.g. `{ onIssue: 'throw' }`. */
  resolveOptions?: { onIssue?: 'collect' | 'throw' }
}

/** What the reader should expect: works / devtools warning / devtools error / the build throws. */
export type CaseLevel = 'ok' | 'warning' | 'error' | 'throws'

/** One documentation case: description, the code (region `slug` in the group file), what it renders and reports. */
export type DocCase = {
  slug: string
  title: string
  /** Polish prose, technical names in English. Paragraphs separated by an empty line, `- ` for list items, `code` in backticks. */
  description: string
  level: CaseLevel
  /** Extra code shown before the case code: a whole file of the example or its `// #region <name>` (path from the example root). */
  files?: { title: string; file: string; region?: string }[]
  /** Exercises (debugging): a symptom, where to look, the solution (collapsed until opened). */
  tasks?: { symptom: string; hint: string; solution: string }[]
  /** Collapse the case code (spoiler — e.g. exercises solved with devtools first). */
  codeCollapsed?: boolean
  /** Render without the `deferred` prop: deferred sections show only their placeholder (`defer.fallback`). */
  placeholderOnly?: boolean
  /** Registry override — e.g. without a component, to show a missing one. Default: Radix Themes. */
  registry?: Partial<Registry<Contract>>
  run: () => Promise<CaseOutput>
}

export type DocGroup = {
  slug: string
  title: string
  /** One line for the menu and the group list. */
  description: string
  /** The group page: context, how it works, why so, how to use — Polish prose; `## ` headings, ``` code blocks, `- ` lists. */
  intro: string
  /** The file the page text comes from, relative to the repository root — for "Edit this page" (default: the intros file). */
  source?: string
  /** The group file whose `#region`s are shown as code (empty for groups without cases). */
  file: string
  cases: DocCase[]
}
