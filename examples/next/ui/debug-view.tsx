import type { CSSProperties, ReactNode } from 'react'
import type { BindingReport } from 'dedal'
import {
  bindingMessages,
  droppedMessages,
  layoutSelectorMessages,
  NO_QUERY_TIMINGS,
  pageMessages,
  QUERY_STATUS,
  queryLabel,
  querySummary,
  type BuildTiming,
  type DevtoolsPayload,
  type InspectedNode,
  type InspectedProp,
  type UnmatchedBinding,
} from 'dedal/devtools'

// debug view with inline styles — independent of Tailwind and Radix Themes, rendered on the server from inspect()
const box: CSSProperties = { maxWidth: 1120, margin: '0 auto 48px', padding: '0 24px', font: '13px/1.5 ui-monospace, monospace' }
const panel: CSSProperties = { background: '#111', color: '#eee', borderRadius: 8, padding: 16, marginBottom: 16, overflowX: 'auto' }
const muted: CSSProperties = { color: '#888' }
const tag = (color: string): CSSProperties => ({ color, border: `1px solid ${color}`, borderRadius: 4, padding: '0 4px', marginLeft: 6 })

const sourceColors: Record<string, string> = { page: '#9cf', section: '#c9f', deferred: '#fc6', none: '#888' }

const levelColor = { error: '#f66', warning: '#fc6', info: '#888', ok: '#9f9' } as const
const levelIcon = { error: '✗', warning: '!', info: '·', ok: '✓' } as const

/** Section binding: counts (report fields), sentences explaining the problem (same texts as the panel), unused data. */
function Binding({ binding, problem }: { binding: BindingReport; problem?: UnmatchedBinding }) {
  const { level, summary, notes, suggestions } = bindingMessages(binding, problem)
  const color = levelColor[level]

  return (
    <div style={{ margin: '10px 0' }}>
      <span style={{ color }}>{levelIcon[level]} </span>
      <span style={{ color: '#9cf' }}>{binding.selector}</span>
      <span style={muted}>
        {' — '}
        {summary}
      </span>
      {notes.map((note, i) => (
        <div key={note} style={{ paddingLeft: 18, marginTop: 2, color }}>
          {note}
          {i === 0 && suggestions.length > 0 && ` Did you mean: ${suggestions.join(', ')}?`}
        </div>
      ))}
      {binding.unusedItems && binding.unusedItems.length > 0 && (
        <div style={{ paddingLeft: 18, ...muted }}>
          {binding.unusedItems.map(item => (
            <div key={item.index} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              [{item.index}] {item.preview}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const value = (input: unknown) => {
  const text = JSON.stringify(input) ?? String(input)
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

/** Prop origin as a short label: patch with selector, data, default, template. */
function Source({ prop }: { prop: InspectedProp }) {
  const { source } = prop
  if (!source) return null
  if (source.from === 'patch') return <span style={{ color: '#fc6' }}> ← patch {source.selector}</span>
  if (source.from === 'data') return <span style={{ color: '#9f9' }}> ← data</span>
  return <span style={muted}> ← {source.from}</span>
}

function NodeRow({ node, nodes, depth }: { node: InspectedNode; nodes: DevtoolsPayload['nodes']; depth: number }): ReactNode {
  return (
    <>
      <div style={{ paddingLeft: depth * 16, marginTop: 4 }}>
        <strong>{node.component}</strong>
        {node.alias && <span style={{ color: '#fc6' }}> #{node.alias}</span>}
        {node.slot && <span style={muted}> :slot({node.slot})</span>}
        <span style={muted}> {node.id}</span>
        <span style={{ color: '#9cf' }}> {node.selector}</span>
        {node.data && <span style={tag('#9f9')}>data{node.data.selector ? ` ← ${node.data.selector}` : ''}</span>}
        {node.issues.map(issue => (
          <span key={issue} style={tag('#f66')}>
            {issue}
          </span>
        ))}
        {Object.entries(node.props).map(([name, prop]) => (
          <div key={name} style={{ paddingLeft: 16 }}>
            <span style={muted}>{name}:</span> {value(prop.value)}
            <Source prop={prop} />
          </div>
        ))}
      </div>
      {node.children.map(id => (
        <NodeRow key={id} node={nodes[id]} nodes={nodes} depth={depth + 1} />
      ))}
    </>
  )
}

const statusColor = { hit: '#9f9', stale: '#fc6', miss: '#9cf', bypass: '#888', error: '#f66' } as const

const stageColor = { layout: '#c9f', load: '#4af', assign: '#9f9' } as const

/**
 * One build, read top to bottom: what the total is made of, the loaders on the build's time axis (they run in parallel —
 * data loading takes as long as the slowest), the queries of each loader with their cache status.
 */
function Timing({ timing }: { timing: BuildTiming }) {
  const scale = Math.max(timing.total, 0.1)
  const percent = (value: number) => `${Math.min((value / scale) * 100, 100)}%`
  const loaders = [...timing.loaders].sort((a, b) => a.start - b.start)
  const slowest = loaders.reduce<(typeof loaders)[number] | undefined>((max, loader) => (!max || loader.duration > max.duration ? loader : max), undefined)
  const summary = querySummary(timing)
  const stages = [
    ['layout', timing.layout],
    ['data loading', timing.load],
    ['assign', timing.assign],
  ] as const

  return (
    <div style={{ marginTop: 16 }}>
      <strong>{timing.scope === 'page' ? 'page build' : `section ${timing.scope} (streamed separately)`}</strong> — {timing.total} ms
      <div style={{ display: 'flex', height: 10, margin: '6px 0 2px', borderRadius: 2, overflow: 'hidden', background: '#222' }}>
        {stages.map(([name, value], i) => (
          <span key={name} title={`${name} ${value} ms`} style={{ minWidth: 2, width: percent(value), background: Object.values(stageColor)[i] }} />
        ))}
      </div>
      <div style={muted}>
        {stages.map(([name, value], i) => (
          <span key={name} style={{ marginRight: 12 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: Object.values(stageColor)[i] }} /> {name} {value} ms
          </span>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        data loading — {loaders.length} loader{loaders.length === 1 ? '' : 's'}
        {loaders.length > 1 && <span style={muted}> (they run in parallel; data loading takes as long as the slowest one)</span>}
      </div>
      {loaders.map(loader => (
        <div key={loader.loader} style={{ marginTop: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 70px', gap: 8, alignItems: 'center' }}>
            <span style={{ color: loader.failed ? '#f66' : undefined }}>{loader.loader === 'page' ? 'page data' : loader.loader}</span>
            <div style={{ position: 'relative', height: 8, background: '#222', borderRadius: 2 }}>
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  minWidth: 2,
                  borderRadius: 2,
                  background: loader.failed ? '#f66' : '#4af',
                  left: percent(loader.start),
                  width: percent(loader.duration),
                }}
              />
            </div>
            <span style={{ textAlign: 'right' }}>{loader.duration} ms</span>
          </div>
          {loader.failed && <div style={{ paddingLeft: 18, color: '#f66' }}>failed — the loader threw (see the section messages above)</div>}
          {!loader.failed && loader === slowest && loaders.length > 1 && <div style={{ paddingLeft: 18, ...muted }}>slowest — data loading waits for it</div>}
          {timing.queries
            ?.filter(query => query.loader === loader.loader)
            .map(query => (
              <div key={`${query.key}${query.start}`} style={{ paddingLeft: 18, color: '#aaa' }}>
                query {queryLabel(query.key)} <span style={{ color: statusColor[query.status] }}>{query.status}</span> {query.duration} ms —{' '}
                {QUERY_STATUS[query.status]}
              </div>
            ))}
        </div>
      ))}

      <div style={{ marginTop: 10 }}>
        queries{summary ? ` — ${summary}` : ''}
        {!summary && <div style={muted}>{NO_QUERY_TIMINGS}</div>}
      </div>
    </div>
  )
}

/** Readable view of the devtools payload: sections (data source, cache), node tree with selectors and prop origins. */
export function DebugView({ payload }: { payload: DevtoolsPayload }) {
  const { sections, nodes } = payload

  return (
    <aside style={box}>
      <h2>debug — inspect()</h2>

      <div style={panel}>
        {pageMessages(payload).map(message => (
          <div
            key={`${message.subject ?? ''}${message.text}`}
            style={{
              display: 'flex',
              gap: 6,
              margin: '6px 0',
              padding: '5px 8px',
              borderLeft: `3px solid ${levelColor[message.level]}`,
              borderRadius: 3,
              background: '#1a1a1a',
              color: levelColor[message.level],
            }}
          >
            <span>{levelIcon[message.level]}</span>
            <div>
              {message.subject && <span style={{ color: '#9cf' }}>{message.subject} </span>}
              {message.text}
              {message.suggestions && ` Did you mean: ${message.suggestions.join(', ')}?`}
            </div>
          </div>
        ))}
      </div>

      {payload.page.timings && payload.page.timings.length > 0 && (
        <div style={panel}>
          <div style={{ fontSize: 15 }}>
            <strong>timing</strong>
            <span style={muted}> — server-side build time; debug builds bypass the page cache, the query cache still applies</span>
          </div>
          {payload.page.timings.map(timing => (
            <Timing key={timing.scope} timing={timing} />
          ))}
        </div>
      )}

      {sections.map(section => (
        <div key={section.key} style={panel}>
          <div style={{ fontSize: 15 }}>
            <strong>section {section.key}</strong>
            {section.source && <span style={tag(sourceColors[section.source])}>source: {section.source}</span>}
            {section.deferred && <span style={tag('#fc6')}>deferred — fallback</span>}
            {section.removed && <span style={tag('#888')}>removed — no data; layout before assign</span>}
          </div>

          {section.report?.bindings.map(binding => (
            <Binding key={binding.selector} binding={binding} problem={section.diagnosis?.unmatched.find(problem => problem.selector === binding.selector)} />
          ))}
          {layoutSelectorMessages(section.diagnosis).map(({ text, suggestions }) => (
            <div key={text} style={{ color: '#fc6' }}>
              ! {text}
              {suggestions.length > 0 && ` Did you mean: ${suggestions.join(', ')}?`}
            </div>
          ))}
          {droppedMessages(section.diagnosis).map(text => (
            <div key={text} style={{ color: '#fc6' }}>
              ! {text}
            </div>
          ))}

          <NodeRow node={nodes[section.root]} nodes={nodes} depth={0} />
        </div>
      ))}
    </aside>
  )
}
