import Link from 'next/link'
import { Fragment, Suspense, type ReactNode } from 'react'
import { Theme } from '@radix-ui/themes'
import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render, type Registry } from 'dedal/react'
import { Code, langOf } from '@/components/docs-code'
import { GITHUB } from '@/lib/site'
import type { Contract, Ctx } from '../contract'
import { radixThemes } from '../registries/radix-themes'
import { LIVE_THROWS, live } from './live'
import { caseCode, codeOf, runCase } from './run'
import type { CaseLevel, CaseOutput, DocCase, DocGroup } from './types'

export const levels: Record<CaseLevel, { label: string; className: string }> = {
  ok: { label: 'works', className: 'ok' },
  warning: { label: 'devtools warning', className: 'warning' },
  error: { label: 'devtools error', className: 'error' },
  throws: { label: 'the build throws', className: 'throws' },
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const docHref = (slug: string) => `/docs/${slug}/`

const SITE = 'https://dawidglosny.github.io/dedal'

/** A link target: the docs site itself → an internal link; a path relative to `docs/` in the repository → GitHub. */
function LinkTo({ href, children }: { href: string; children: ReactNode }) {
  // the type reference is static files from TypeDoc, outside the app's routes — a plain link
  if (href.startsWith(`${SITE}/types/`)) return <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${href.slice(SITE.length)}`}>{children}</a>
  if (href.startsWith(SITE)) return <Link href={href.slice(SITE.length) || '/'}>{children}</Link>
  if (href.startsWith('#') || /^[a-z]+:/.test(href)) return <a href={href}>{children}</a>
  return <a href={new URL(href, `${GITHUB}/blob/main/docs/`).href}>{children}</a>
}

/** Inline text: `code`, **bold**, *emphasis* (tab names) and [links](url). */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\*[^*]+\*)/).map((part, i) =>
        part.startsWith('[') && /^\[[^\]]+\]\([^)\s]+\)$/.test(part) ? (
          <LinkTo key={i} href={part.slice(part.indexOf('](') + 2, -1)}>
            <Inline text={part.slice(1, part.indexOf(']('))} />
          </LinkTo>
        ) : part.startsWith('`') ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : part.startsWith('**') ? (
          <strong key={i}>
            <Inline text={part.slice(2, -2)} />
          </strong>
        ) : part.startsWith('*') ? (
          <em key={i}>
            <Inline text={part.slice(1, -1)} />
          </em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

type ProsePart = { kind: 'p' | 'h2' | 'h3' | 'ul' | 'pre' | 'table'; lines: string[]; lang?: string }

/** Table cells: split on `|`, except an escaped `\\|` (e.g. inside a selector). */
const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map(cell => cell.trim().replace(/\\\|/g, '|'))

function parseProse(text: string): ProsePart[] {
  const parts: ProsePart[] = []
  let current: ProsePart | undefined
  let fenced = false

  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (fenced) current = undefined
      else parts.push((current = { kind: 'pre', lines: [], lang: line.slice(3).trim() || undefined }))
      fenced = !fenced
      continue
    }
    if (fenced) {
      current!.lines.push(line)
      continue
    }
    if (!line.trim()) {
      current = undefined
      continue
    }
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const kind = line.startsWith('## ') ? 'h2' : 'h3'
      parts.push({ kind, lines: [line.slice(kind === 'h2' ? 3 : 4)] })
      current = undefined
      continue
    }
    if (line.startsWith('|')) {
      if (current?.kind !== 'table') parts.push((current = { kind: 'table', lines: [] }))
      if (!/^\|[\s:|-]+\|$/.test(line.trim())) current.lines.push(line) // skip the |---| row
      continue
    }
    const kind = line.startsWith('- ') ? 'ul' : 'p'
    if (current?.kind !== kind) parts.push((current = { kind, lines: [] }))
    current.lines.push(kind === 'ul' ? line.slice(2) : line)
  }
  return parts
}

/** `## ` and `### ` headings of a prose text — for the table of contents. */
export const proseHeadings = (text: string) =>
  parseProse(text)
    .filter(part => part.kind === 'h2' || part.kind === 'h3')
    .map(part => ({ id: slugify(part.lines[0]), title: part.lines[0], level: part.kind === 'h3' ? 3 : 2 }))

/** Prose: paragraphs (empty line), `## ` headings, `- ` lists, ``` code blocks. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {parseProse(text).map((part, i) =>
        part.kind === 'pre' ? (
          <Code key={i} code={part.lines.join('\n')} lang={langOf(part.lang)} />
        ) : part.kind === 'h2' ? (
          <h2 key={i} id={slugify(part.lines[0])}>
            <Inline text={part.lines[0]} />
          </h2>
        ) : part.kind === 'h3' ? (
          <h3 key={i} id={slugify(part.lines[0])}>
            <Inline text={part.lines[0]} />
          </h3>
        ) : part.kind === 'table' ? (
          <div key={i} className="table">
            <table>
              <thead>
                <tr>
                  {cells(part.lines[0]).map((cell, j) => (
                    <th key={j}>
                      <Inline text={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {part.lines.slice(1).map(row => (
                  <tr key={row}>
                    {cells(row).map((cell, j) => (
                      <td key={j}>
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : part.kind === 'ul' ? (
          <ul key={i}>
            {part.lines.map(line => (
              <li key={line}>
                <Inline text={line} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inline text={part.lines.join(' ')} />
          </p>
        )
      )}
    </>
  )
}

/** "See it live": what to open in the devtools panel for this case (or why it is empty when the build throws). */
function LiveHint({ text, throws }: { text?: string; throws: boolean }) {
  if (!text) return null
  return (
    <div className={`callout ${throws ? 'callout-throws' : 'callout-live'}`}>
      <strong>{throws ? 'Devtools' : 'See it live'}</strong>
      {!throws && (
        <span className="callout-note">
          {' '}
          — open the panel: the button with the Dedal logo in the bottom-right corner, or <code>Alt+Shift+S</code>
        </span>
      )}
      <div>
        <Inline text={text} />
      </div>
    </div>
  )
}

/** Exercises: numbered symptoms, where to look, solutions collapsed until opened. */
function Tasks({ tasks }: { tasks: NonNullable<DocCase['tasks']> }) {
  return (
    <>
      <h2 id="tasks">Tasks</h2>
      <ol className="tasks">
        {tasks.map(task => (
          <li key={task.symptom}>
            <div className="task-symptom">
              <Inline text={task.symptom} />
            </div>
            <div className="task-hint">
              <span>Where to look: </span>
              <Inline text={task.hint} />
            </div>
            <details>
              <summary>Solution</summary>
              <div className="task-solution">
                <Prose text={task.solution} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </>
  )
}

export function Badge({ level }: { level: CaseLevel }) {
  return <span className={`badge ${levels[level].className}`}>{levels[level].label}</span>
}

/** A deferred section of a case: built separately and rendered into its placeholder. */
async function DeferredCaseSection({ output, sectionKey, registry }: { output: CaseOutput; sectionKey: string; registry: Partial<Registry<Contract>> }) {
  const result = await output.page!.section(sectionKey, output.ctx as Ctx, { trace: true })
  const resolved = output.ui.resolve(result, { ctx: output.ctx, trace: true })
  return (
    <>
      <Render tree={resolved} registry={registry} debug />
      <DevtoolsData payload={inspect(result, resolved)} />
    </>
  )
}

const missing = ({ component }: { component: string }) => <div className="missing">Missing component “{component}”</div>

type TocEntry = { id: string; title: string; level?: number }

/**
 * Radix Themes' CSS, scoped to `.dedal-preview` (see `app/radix-themes.css/route.ts`) and loaded only by the pages that
 * render a live result: React hoists the stylesheet into `<head>` and loads it once.
 */
function PreviewStyles() {
  return <link rel="stylesheet" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/radix-themes.css`} precedence="radix-themes" />
}

/** The content of a case page, under its title: description, code, result and what devtools report (or the thrown error). */
export async function caseContent(group: DocGroup, docCase: DocCase): Promise<{ toc: TocEntry[]; body: ReactNode }> {
  const registry = docCase.registry ?? (radixThemes as Partial<Registry<Contract>>)
  const run = await runCase(docCase, registry)
  const toc = [
    ...(docCase.files ?? []).map(({ title }) => ({ id: slugify(title), title: title[0].toUpperCase() + title.slice(1) })),
    ...(docCase.tasks ? [{ id: 'tasks', title: 'Tasks' }] : []),
    { id: 'code', title: 'Code' },
    ...(run.kind === 'thrown'
      ? [{ id: 'thrown-error', title: 'Thrown error' }]
      : [
          { id: 'result', title: 'Result' },
          { id: 'devtools-report', title: 'Devtools report' },
        ]),
  ]

  const body = (
    <>
      <Prose text={docCase.description} />
      <LiveHint text={docCase.level === 'throws' ? LIVE_THROWS : live[docCase.slug]} throws={docCase.level === 'throws'} />

      {docCase.files?.map(({ title, file, region }) => (
        <Fragment key={`${file}${region ?? ''}`}>
          <h2 id={slugify(title)}>{title[0].toUpperCase() + title.slice(1)}</h2>
          <Code code={codeOf(file, region)} lang={langOf(file)} title={file} />
        </Fragment>
      ))}

      {docCase.tasks && <Tasks tasks={docCase.tasks} />}

      <h2 id="code">Code</h2>
      {docCase.codeCollapsed ? (
        <details className="spoiler">
          <summary>Show the code (spoiler — try the panel first)</summary>
          <Code code={caseCode(group, docCase.slug)} title={`ui/docs/${group.file}`} />
        </details>
      ) : (
        <Code code={caseCode(group, docCase.slug)} title={`ui/docs/${group.file}`} />
      )}

      {run.kind === 'thrown' ? (
        <>
          <h2 id="thrown-error">Thrown error</h2>
          <Code code={run.message} tone="error" />
        </>
      ) : (
        <>
          <h2 id="result">Result</h2>
          <PreviewStyles />
          <div className="result dedal-preview not-prose">
            <Theme appearance="light" accentColor="indigo" grayColor="slate" radius="medium" hasBackground={false}>
              <Render
                tree={run.resolved}
                registry={registry}
                debug
                fallback={missing}
                deferred={
                  docCase.placeholderOnly
                    ? undefined
                    : ({ sectionKey, fallback }) => (
                        <Suspense fallback={fallback}>
                          <DeferredCaseSection output={run.output} sectionKey={sectionKey} registry={registry} />
                        </Suspense>
                      )
                }
              />
            </Theme>
          </div>

          <h2 id="devtools-report">Devtools report</h2>
          <Code code={run.report} lang="text" />
          <DevtoolsData payload={run.payload} />
        </>
      )}
    </>
  )
  return { toc, body }
}

/** The content of a group page, under its title: the context of this part of Dedal, then its cases. */
export function groupContent(group: DocGroup): { toc: TocEntry[]; body: ReactNode } {
  const toc = [...proseHeadings(group.intro ?? ''), ...(group.cases.length ? [{ id: 'cases', title: 'Cases in this group' }] : [])]
  const body = (
    <>
      <Prose text={group.intro ?? ''} />

      <CaseList group={group} />
    </>
  )
  return { toc, body }
}

/** The cases of a group, under its intro — also below the MDX group pages. */
export function CaseList({ group }: { group: DocGroup }) {
  if (!group.cases.length) return null
  return (
    <>
      <h2 id="cases">Cases in this group</h2>
      <div className="case-list not-prose">
        {group.cases.map(docCase => (
          <Link key={docCase.slug} href={docHref(docCase.slug)} className="case-card">
            <span className={`dot ${levels[docCase.level].className}`} />
            <span className="case-title">{docCase.title}</span>
            <span className="case-level">{levels[docCase.level].label}</span>
          </Link>
        ))}
      </div>
    </>
  )
}

/** The file to edit for a page, relative to the repository root. */
export const editPath = (group: DocGroup, docCase?: DocCase) =>
  docCase ? `site/ui/docs/${group.file}` : (group.source ?? `site/content/docs/${group.slug}.mdx`)

