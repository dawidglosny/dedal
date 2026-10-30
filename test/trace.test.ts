import { describe, expect, it, vi } from 'vitest'
import { createDedal } from '../src'

type Contract = {
  grid: { columns?: number; gap?: string }
  card: { size?: 'sm' | 'md' | 'lg'; title?: string; style?: { height?: string } }
  skeleton: Record<string, never>
}
type Ctx = { device: 'desktop' | 'mobile' }

const ui = createDedal<Contract>({ defaults: { card: { size: 'md' }, grid: { gap: 'md' } } })
const { node, repeat, section } = ui

describe('props source in the layout', () => {
  it('layout with trace tells default from template', () => {
    const root = ui.layout(node('grid', { props: { columns: 2 }, children: [node('card', { props: { title: 'x' } })] }), 'n', {
      trace: true,
    })

    expect(root.trace).toEqual({ gap: { from: 'default' }, columns: { from: 'template' } })
    expect(root.children![0].trace).toEqual({ size: { from: 'default' }, title: { from: 'template' } })
  })

  it('a template overriding a default value counts as template', () => {
    const root = ui.layout(node('card', { props: { size: 'lg' } }), 'n', { trace: true })

    expect(root.trace).toEqual({ size: { from: 'template' } })
  })

  it('patch with trace records the selector and section; a later patch wins', () => {
    const root = ui.layout(node('grid', { children: [repeat(node('card'), 2)] }), 'n', { trace: true })
    const patched = ui.patch(root, { card: { size: 'sm' }, 'card:first-child': { size: 'lg', style: { height: '1px' } } }, {
      trace: true,
      section: 'news',
    })

    expect(patched.children![0].trace).toEqual({
      size: { from: 'patch', selector: 'card:first-child', section: 'news' },
      style: { from: 'patch', selector: 'card:first-child', section: 'news' },
    })
    expect(patched.children![1].trace).toEqual({ size: { from: 'patch', selector: 'card', section: 'news' } })
  })

  it('without trace layout and patch add no trace field', () => {
    const root = ui.patch(ui.layout(node('grid', { children: [node('card')] }), 'n'), { card: { size: 'sm' } })

    expect(JSON.stringify(root)).not.toContain('trace')
  })
})

describe('build(ctx, { trace })', () => {
  const setup = () => {
    const load = vi.fn(async () => ({ news: { card: [{ title: 'A' }, { title: 'B' }] } }))
    const home = ui.page<Ctx>({
      sections: ({ device }) => [
        section('news', node('grid', { children: [repeat(node('card'), 2)] }), {
          patch: device === 'desktop' ? { 'card:first-child': { size: 'lg' } } : {},
        }),
        section('menu', node('card'), { data: async () => ({ card: [{ title: 'M' }] }) }),
        section('forYou', node('card'), { defer: { fallback: node('skeleton') }, data: async () => ({ card: [] }) }),
        section('static', node('card', { props: { title: 'fixed' } })),
      ],
      data: load,
      cache: { key: ctx => ['home', ctx.device] },
    })
    return { home, load }
  }

  it('props source carries over to resolve: default, template, patch with section, data', async () => {
    const { home } = setup()
    const resolved = ui.resolve(await home.build({ device: 'desktop' }, { trace: true }), { trace: true })
    const [first, second] = resolved.sections[0].tree.children!

    expect(first.trace).toEqual({
      size: { from: 'patch', selector: 'card:first-child', section: 'news' },
      title: { from: 'data' },
    })
    expect(second.trace).toEqual({ size: { from: 'default' }, title: { from: 'data' } })
  })

  it('report.trace: section data sources and the cache key', async () => {
    const { home } = setup()
    const { report } = await home.build({ device: 'mobile' }, { trace: true })

    expect(report.trace).toMatchObject({
      sources: { news: 'page', menu: 'section', forYou: 'deferred', static: 'none' },
      cacheKey: '["page","home","mobile"]',
      cacheOption: true,
    })
  })

  it('trace bypasses the cache: neither reads from nor writes to it', async () => {
    const { home, load } = setup()

    await home.build({ device: 'desktop' })
    await home.build({ device: 'desktop' }, { trace: true })
    await home.build({ device: 'desktop' }, { trace: true })
    const normal = await home.build({ device: 'desktop' })

    expect(load).toHaveBeenCalledTimes(3)
    expect(normal.report.trace).toBeUndefined()
    expect(JSON.stringify(normal)).not.toContain('"trace"')
  })

  it('a result with trace round-trips through JSON unchanged', async () => {
    const { home } = setup()
    const result = await home.build({ device: 'desktop' }, { trace: true })

    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('page.section with trace: section source, no page cache key', async () => {
    const { home } = setup()
    const { report } = await home.section('menu', { device: 'desktop' }, { trace: true })

    expect(report.trace).toMatchObject({ sources: { menu: 'section' }, cacheKey: null, timing: { scope: 'menu' } })
    expect(report.trace).not.toHaveProperty('cacheOption')
  })
})
