import { Suspense, type CSSProperties } from 'react'
import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render, type Registry } from 'dedal/react'
import { Devtools } from 'dedal/react/devtools'
import type { Contract, Ctx } from './contract'
import { home } from './home.page'
import { ui } from './dedal'
import { DebugView } from './debug-view'

export type Search = { device?: string; debug?: string }

const libraries = [
  { path: '/shadcn', label: 'shadcn/ui' },
  { path: '/radix', label: 'Radix Themes' },
]

// toolbar with inline styles — independent of Tailwind and Radix Themes
const bar: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 24,
  padding: '10px 24px',
  background: '#111',
  color: '#eee',
  font: '13px/1.4 ui-monospace, monospace',
}
const link = (active: boolean): CSSProperties => ({ color: active ? '#fff' : '#9cf', fontWeight: active ? 700 : 400 })

/** Deferred section: async server component — page.section() + resolve + Render, streamed through <Suspense>. */
async function DeferredSection({
  sectionKey,
  ctx,
  registry,
  debug,
}: {
  sectionKey: string
  ctx: Ctx
  registry: Registry<Contract>
  debug: boolean
}) {
  const result = await home.section(sectionKey, ctx, { trace: debug })
  const resolved = ui.resolve(result, { ctx, trace: debug })

  return (
    <>
      <Render tree={resolved} registry={registry} debug={debug} />
      {/* section payload from its own request — the panel attaches it to the page payload */}
      {debug && <DevtoolsData payload={inspect(result, resolved)} />}
    </>
  )
}

/**
 * Shared page view: `build` → `resolve` → `<Render>` with the given library's registry.
 * Same contract, same page and data — only `registry` differs.
 */
export async function PageView({ path, registry, searchParams }: { path: string; registry: Registry<Contract>; searchParams: Search }) {
  const ctx: Ctx = { device: searchParams.device === 'mobile' ? 'mobile' : 'desktop' }
  const debug = searchParams.debug === '1'

  // debug: build with props origin tracing, bypassing the page cache
  const result = await home.build(ctx, { trace: debug })
  const resolved = ui.resolve(result, { ctx, trace: debug })
  const payload = debug ? inspect(result, resolved) : undefined

  const href = (target: string, patch: Search = {}) => {
    const params = new URLSearchParams({ device: ctx.device, ...(debug && { debug: '1' }), ...patch })
    if (patch.debug === '0') params.delete('debug')
    return `${target}?${params}`
  }

  const Container = registry.container

  return (
    <>
      <nav style={bar}>
        <strong>dedal</strong>
        <span>
          library:{' '}
          {libraries.map(library => (
            <a key={library.path} href={href(library.path)} style={{ ...link(library.path === path), marginRight: 8 }}>
              {library.label}
            </a>
          ))}
        </span>
        <span>
          ctx.device:{' '}
          <a href={href(path, { device: 'desktop' })} style={{ ...link(ctx.device === 'desktop'), marginRight: 8 }}>
            desktop
          </a>
          <a href={href(path, { device: 'mobile' })} style={link(ctx.device === 'mobile')}>
            mobile
          </a>
        </span>
        <a href={`/api/home?device=${ctx.device}`} style={link(false)}>
          JSON (/api/home)
        </a>
        {/* right side: docs and the debug toggle */}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
          <a href="https://dawidglosny.github.io/dedal/" style={link(false)}>
            docs — all cases, errors and warnings
          </a>
          <a href={href(path, { debug: debug ? '0' : '1' })} style={link(debug)}>
            {debug ? 'hide debug' : 'debug'}
          </a>
        </span>
      </nav>

      <div style={ctx.device === 'mobile' ? { maxWidth: 420, margin: '0 auto' } : undefined}>
        <Container size="lg">
          <Render
            tree={resolved}
            registry={registry}
            debug={debug}
            deferred={({ sectionKey, fallback }) => (
              <Suspense fallback={fallback}>
                <DeferredSection sectionKey={sectionKey} ctx={ctx} registry={registry} debug={debug} />
              </Suspense>
            )}
            fallback={({ component }) => <div style={{ padding: 12, border: '2px dashed #c33' }}>Missing component “{component}”</div>}
          />
        </Container>
      </div>

      {payload && (
        <>
          {/* debug mode: devtools payload on the page + panel (“dedal” button in the bottom-right corner) */}
          <DevtoolsData payload={payload} />
          <Devtools />
          <DebugView payload={payload} />
        </>
      )}
    </>
  )
}
