import { Fragment, Suspense, type CSSProperties, type ReactNode } from 'react'
import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render, type Registry } from 'dedal/react'
import { Devtools } from 'dedal/react/devtools'
import type { Contract, Ctx } from '../contract'
import { radixThemes } from '../registries/radix-themes'
import { groups, readingOrder } from './index'
import { LIVE_THROWS, live } from './live'
import { caseCode, codeOf, runCase } from './run'
import type { CaseLevel, CaseOutput, DocCase, DocGroup } from './types'

// docs chrome with inline styles — independent of the rendered library
const page: CSSProperties = { display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh', font: '14px/1.6 system-ui, sans-serif' }
const sidebar: CSSProperties = { background: '#111', color: '#ccc', padding: '20px 16px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }
const main: CSSProperties = { padding: '32px 40px 80px', maxWidth: 1040 }
const mono: CSSProperties = { font: '12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace' }
const block: CSSProperties = { ...mono, background: '#111', color: '#e8e8e8', borderRadius: 8, padding: '14px 16px', overflowX: 'auto', whiteSpace: 'pre' }
const heading: CSSProperties = { font: '600 12px/1 system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', color: '#666', margin: '28px 0 10px' }

const levels: Record<CaseLevel, { label: string; color: string }> = {
  ok: { label: 'works', color: '#2b8a3e' },
  warning: { label: 'devtools warning', color: '#b7791f' },
  error: { label: 'devtools error', color: '#c92a2a' },
  throws: { label: 'the build throws', color: '#862e9c' },
}

/** Inline text: `code`, **bold** and *emphasis* (tab names). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) =>
        part.startsWith('`') ? (
          <code key={i} style={{ ...mono, background: '#f1f3f5', padding: '1px 5px', borderRadius: 4 }}>
            {part.slice(1, -1)}
          </code>
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

/** Prose: paragraphs (empty line), `## ` headings, `- ` lists, ``` code blocks. */
function Prose({ text }: { text: string }) {
  type Part = { kind: 'p' | 'h2' | 'ul' | 'pre'; lines: string[] }
  const parts: Part[] = []
  let current: Part | undefined
  let fenced = false

  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (fenced) current = undefined
      else parts.push((current = { kind: 'pre', lines: [] }))
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

  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'pre' ? (
          <pre key={i} style={{ ...block, margin: '0 0 14px' }}>
            {part.lines.join('\n')}
          </pre>
        ) : part.kind === 'h2' ? (
          <h2 key={i} style={{ fontSize: 19, margin: '26px 0 8px' }}>
            {part.lines[0]}
          </h2>
        ) : part.kind === 'ul' ? (
          <ul key={i} style={{ margin: '0 0 14px', paddingLeft: 22 }}>
            {part.lines.map(line => (
              <li key={line} style={{ marginBottom: 3 }}>
                <Inline text={line} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} style={{ margin: '0 0 14px' }}>
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
  const color = throws ? '#862e9c' : '#1c7ed6'
  return (
    <div style={{ margin: '8px 0 4px', padding: '10px 14px', borderLeft: `4px solid ${color}`, borderRadius: 6, background: throws ? '#f8f0fc' : '#e7f5ff' }}>
      <strong style={{ color }}>{throws ? 'Devtools' : 'See it live'}</strong>
      {!throws && (
        <span style={{ color: '#555' }}>
          {' '}
          — open the panel: the <strong>dedal</strong> button in the bottom-right corner, or <code style={mono}>Alt+Shift+S</code>
        </span>
      )}
      <div style={{ marginTop: 4 }}>
        <Inline text={text} />
      </div>
    </div>
  )
}

/** Exercises: numbered symptoms, where to look, solutions collapsed until opened. */
function Tasks({ tasks }: { tasks: NonNullable<DocCase['tasks']> }) {
  return (
    <>
      <div style={heading}>tasks</div>
      <ol style={{ paddingLeft: 22, margin: 0 }}>
        {tasks.map(task => (
          <li key={task.symptom} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600 }}>
              <Inline text={task.symptom} />
            </div>
            <div style={{ color: '#555', marginTop: 2 }}>
              <span style={{ color: '#1c7ed6', fontWeight: 600 }}>Where to look: </span>
              <Inline text={task.hint} />
            </div>
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', color: '#2b8a3e', fontWeight: 600 }}>Solution</summary>
              <div style={{ marginTop: 6, padding: '8px 12px', background: '#f4fce3', borderRadius: 6 }}>
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
  const { label, color } = levels[level]
  return <span style={{ color, border: `1px solid ${color}`, borderRadius: 999, padding: '1px 10px', fontSize: 12, marginLeft: 12, verticalAlign: 'middle' }}>{label}</span>
}

function Sidebar({ current }: { current: string }) {
  return (
    <nav style={sidebar}>
      <a href="/radix" style={{ color: '#9cf', textDecoration: 'none', fontWeight: 700 }}>
        dedal
      </a>{' '}
      <span style={{ color: '#777' }}>docs</span>
      {groups.map(group => (
        <div key={group.slug} style={{ marginTop: 20 }}>
          <a
            href={`/docs/${group.slug}`}
            style={{ ...heading, display: 'block', color: group.slug === current ? '#fff' : '#888', margin: '0 0 6px', textDecoration: 'none' }}
          >
            {group.title}
          </a>
          {group.cases.map(docCase => (
            <a
              key={docCase.slug}
              href={`/docs/${docCase.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 8px',
                borderRadius: 4,
                color: docCase.slug === current ? '#fff' : '#bbb',
                background: docCase.slug === current ? '#234' : undefined,
                textDecoration: 'none',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 7, background: levels[docCase.level].color, flex: 'none' }} />
              {docCase.title}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** A deferred section of a case: built in its own request and streamed (like the home page). */
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

const missing = ({ component }: { component: string }) => (
  <div style={{ padding: 12, border: '2px dashed #c33', borderRadius: 6, color: '#c33' }}>Missing component “{component}”</div>
)

function Frame({ children }: { children: ReactNode }) {
  return <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 24px', background: '#fff' }}>{children}</div>
}

/** A documentation page: description, code, result and what devtools report (or the thrown error). */
export async function DocView({ group, docCase }: { group: DocGroup; docCase: DocCase }) {
  const registry = docCase.registry ?? (radixThemes as Partial<Registry<Contract>>)
  const run = await runCase(docCase, registry)
  const next = nextAfter(`/docs/${docCase.slug}`)

  return (
    <div style={page}>
      <Sidebar current={docCase.slug} />
      <main style={main}>
        <div style={{ color: '#888', fontSize: 13 }}>{group.title}</div>
        <h1 style={{ margin: '4px 0 16px', fontSize: 28 }}>
          {docCase.title}
          <Badge level={docCase.level} />
        </h1>
        <Prose text={docCase.description} />
        <LiveHint text={docCase.level === 'throws' ? LIVE_THROWS : live[docCase.slug]} throws={docCase.level === 'throws'} />

        {docCase.files?.map(({ title, file, region }) => (
          <Fragment key={`${file}${region ?? ''}`}>
            <div style={heading}>
              {title} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— {file}</span>
            </div>
            <pre style={block}>{codeOf(file, region)}</pre>
          </Fragment>
        ))}

        {docCase.tasks && <Tasks tasks={docCase.tasks} />}

        {docCase.codeCollapsed ? (
          <details style={{ marginTop: 28 }}>
            <summary style={{ ...heading, display: 'list-item', cursor: 'pointer', margin: 0 }}>code (spoiler — try the panel first)</summary>
            <pre style={{ ...block, marginTop: 10 }}>{caseCode(group, docCase.slug)}</pre>
          </details>
        ) : (
          <>
            <div style={heading}>code</div>
            <pre style={block}>{caseCode(group, docCase.slug)}</pre>
          </>
        )}

        {run.kind === 'thrown' ? (
          <>
            <div style={heading}>thrown error</div>
            <pre style={{ ...block, color: '#ffa8a8', whiteSpace: 'pre-wrap' }}>{run.message}</pre>
          </>
        ) : (
          <>
            <div style={heading}>result</div>
            <Frame>
              <Render
                tree={run.resolved}
                registry={registry}
                debug
                fallback={missing}
                deferred={({ sectionKey, fallback }) => (
                  <Suspense fallback={fallback}>
                    <DeferredCaseSection output={run.output} sectionKey={sectionKey} registry={registry} />
                  </Suspense>
                )}
              />
            </Frame>

            <div style={heading}>devtools report</div>
            <pre style={{ ...block, whiteSpace: 'pre-wrap' }}>{run.report}</pre>
            <DevtoolsData payload={run.payload} />
          </>
        )}

        <Next next={next} />
      </main>
      <Devtools />
    </div>
  )
}

const nextAfter = (href: string) => readingOrder[readingOrder.findIndex(entry => entry.href === href) + 1]

function Next({ next }: { next: (typeof readingOrder)[number] | undefined }) {
  if (!next) return null
  return (
    <p style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
      next: <a href={next.href}>{next.title}</a> <span style={{ color: '#888' }}>({next.group.title})</span>
    </p>
  )
}

/** A group page: the context of this part of Dedal, then its cases. */
export function GroupView({ group }: { group: DocGroup }) {
  return (
    <div style={page}>
      <Sidebar current={group.slug} />
      <main style={main}>
        <div style={{ color: '#888', fontSize: 13 }}>Dedal docs</div>
        <h1 style={{ margin: '4px 0 16px', fontSize: 30 }}>{group.title}</h1>
        <Prose text={group.intro} />

        {group.cases.length > 0 && (
          <>
            <div style={heading}>cases in this group</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {group.cases.map(docCase => (
                <li key={docCase.slug} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f3f5' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: levels[docCase.level].color, flex: 'none', alignSelf: 'center' }} />
                  <a href={`/docs/${docCase.slug}`} style={{ fontWeight: 600, minWidth: 260 }}>
                    {docCase.title}
                  </a>
                  <span style={{ color: '#666', fontSize: 13 }}>{levels[docCase.level].label}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <Next next={nextAfter(`/docs/${group.slug}`)} />
      </main>
      <Devtools />
    </div>
  )
}
