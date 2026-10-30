import Link from 'next/link'
import { Fragment, Suspense, type ReactNode } from 'react'
import { Theme } from '@radix-ui/themes'
import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render, type Registry } from 'dedal/react'
import { Devtools } from 'dedal/react/devtools'
import { Code, langOf } from '@/components/code'
import { GITHUB } from '@/components/header'
import type { Contract, Ctx } from '../contract'
import { radixThemes } from '../registries/radix-themes'
import { findGroup, groups, parts, readingOrder } from './index'
import { LIVE_THROWS, live } from './live'
import { caseCode, codeOf, runCase } from './run'
import type { CaseLevel, CaseOutput, DocCase, DocGroup } from './types'

const levels: Record<CaseLevel, { label: string; className: string }> = {
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

/** Inline text: `code`, **bold** and *emphasis* (tab names). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) =>
        part.startsWith('`') ? (
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

type ProsePart = { kind: 'p' | 'h2' | 'ul' | 'pre'; lines: string[]; lang?: string }

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
    if (line.startsWith('## ')) {
      parts.push({ kind: 'h2', lines: [line.slice(3)] })
      current = undefined
      continue
    }
    const kind = line.startsWith('- ') ? 'ul' : 'p'
    if (current?.kind !== kind) parts.push((current = { kind, lines: [] }))
    current.lines.push(kind === 'ul' ? line.slice(2) : line)
  }
  return parts
}

/** `## ` headings of a prose text — for the table of contents. */
export const proseHeadings = (text: string) =>
  parseProse(text)
    .filter(part => part.kind === 'h2')
    .map(part => ({ id: slugify(part.lines[0]), title: part.lines[0] }))

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

/** The menu: parts → groups; a group's cases are shown only for the group being read (the others can be expanded). */
function Sidebar({ current }: { current: string }) {
  const currentGroup = groups.find(group => group.slug === current || group.cases.some(docCase => docCase.slug === current))
  return (
    <nav className="sidebar">
      {parts.map(part => (
        <div key={part.title} className="sidebar-part">
          <div className="sidebar-part-title">{part.title}</div>
          {part.groups.map(slug => {
            const group = findGroup(slug)!
            const title = (
              <Link href={docHref(group.slug)} className={`sidebar-title${group.slug === current ? ' active' : ''}`}>
                {group.title}
              </Link>
            )
            if (!group.cases.length) return <div key={slug}>{title}</div>
            return (
              <details key={slug} className="sidebar-group" open={group === currentGroup}>
                <summary>
                  {title}
                  <span className="sidebar-count">{group.cases.length}</span>
                </summary>
                {group.cases.map(docCase => (
                  <Link key={docCase.slug} href={docHref(docCase.slug)} className={`sidebar-link${docCase.slug === current ? ' active' : ''}`}>
                    <span className={`dot ${levels[docCase.level].className}`} />
                    {docCase.title}
                  </Link>
                ))}
              </details>
            )
          })}
        </div>
      ))}
      <div className="sidebar-legend">
        {Object.values(levels).map(({ label, className }) => (
          <span key={className}>
            <span className={`dot ${className}`} /> {label}
          </span>
        ))}
      </div>
    </nav>
  )
}

function Toc({ items }: { items: { id: string; title: string }[] }) {
  if (items.length < 2) return <aside className="toc" />
  return (
    <aside className="toc">
      <div className="toc-title">On this page</div>
      {items.map(item => (
        <a key={item.id} href={`#${item.id}`}>
          <Inline text={item.title} />
        </a>
      ))}
    </aside>
  )
}

function Shell({ current, toc, children }: { current: string; toc: { id: string; title: string }[]; children: ReactNode }) {
  return (
    <div className="docs">
      <Sidebar current={current} />
      <main className="doc">{children}</main>
      <Toc items={toc} />
      <Devtools />
    </div>
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

function Badge({ level }: { level: CaseLevel }) {
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

const editLink = (file: string) => `${GITHUB}/blob/main/site/${file}`

function Pager({ href }: { href: string }) {
  const index = readingOrder.findIndex(entry => entry.href === href)
  const prev = readingOrder[index - 1]
  const next = readingOrder[index + 1]
  return (
    <div className="pager">
      {prev ? (
        <Link href={`${prev.href}/`} className="pager-prev">
          <span>Previous</span>
          {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={`${next.href}/`} className="pager-next">
          <span>Next</span>
          {next.title}
        </Link>
      )}
    </div>
  )
}

/** A documentation page: description, code, result and what devtools report (or the thrown error). */
export async function DocView({ group, docCase }: { group: DocGroup; docCase: DocCase }) {
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

  return (
    <Shell current={docCase.slug} toc={toc}>
      <div className="eyebrow">{group.title}</div>
      <h1>
        {docCase.title} <Badge level={docCase.level} />
      </h1>
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
          <div className="result">
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

      <Pager href={`/docs/${docCase.slug}`} />
      <a className="edit" href={editLink(`ui/docs/${group.file}`)}>
        Edit this page on GitHub
      </a>
    </Shell>
  )
}

/** A group page: the context of this part of Dedal, then its cases. */
export function GroupView({ group }: { group: DocGroup }) {
  return (
    <Shell current={group.slug} toc={[...proseHeadings(group.intro), ...(group.cases.length ? [{ id: 'cases', title: 'Cases in this group' }] : [])]}>
      <div className="eyebrow">Documentation</div>
      <h1>{group.title}</h1>
      <Prose text={group.intro} />

      {group.cases.length > 0 && (
        <>
          <h2 id="cases">Cases in this group</h2>
          <div className="case-list">
            {group.cases.map(docCase => (
              <Link key={docCase.slug} href={docHref(docCase.slug)} className="case-card">
                <span className={`dot ${levels[docCase.level].className}`} />
                <span className="case-title">{docCase.title}</span>
                <span className="case-level">{levels[docCase.level].label}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <Pager href={`/docs/${group.slug}`} />
      <a className="edit" href={editLink('ui/docs/intros.ts')}>
        Edit this page on GitHub
      </a>
    </Shell>
  )
}
