import { AsyncLocalStorage } from 'node:async_hooks'
import { describe, expect, it } from 'vitest'
import { createDedal } from '../src'

type C = { grid: Record<string, never>; card: { title?: string } }
const block = (ui: ReturnType<typeof createDedal<C>>) => ui.node('grid', { children: [ui.node('card')] })
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function setup(withContext: boolean) {
  const ui = createDedal<C>(withContext ? { AsyncLocalStorage: AsyncLocalStorage as never } : {})
  const articles = ui.query({ key: (n: number) => ['articles', n], fn: async n => (await wait(5), Array.from({ length: n }, (_, i) => ({ title: `A${i}` }))) })
  const menu = ui.query({ key: () => ['menu'], fn: async () => ({ title: 'menu' }) })
  const page = ui.page({
    sections: [
      ui.section('news', block(ui)),
      ui.section('header', block(ui), { data: async () => ({ card: [await menu()] }) }),
      ui.section('ads', block(ui), {
        optional: true,
        data: async () => {
          throw new Error('503')
        },
      }),
    ],
    data: async () => ({ news: { card: await articles(1) } }),
  })
  return { ui, page }
}

describe('timing (debug builds)', () => {
  it('stages, loaders (page data and sections, failed ones marked) and queries attributed to their loader', async () => {
    const { page } = setup(true)
    await page.build(undefined, { trace: true }) // fills the query cache
    const { report } = await page.build(undefined, { trace: true })
    const timing = report.trace!.timing!

    expect(timing.scope).toBe('page')
    expect(timing.total).toBeGreaterThanOrEqual(timing.layout + timing.load + timing.assign - 0.3)
    expect(timing.loaders.map(({ loader, failed }) => ({ loader, failed }))).toEqual(
      expect.arrayContaining([
        { loader: 'page', failed: undefined },
        { loader: 'header', failed: undefined },
        { loader: 'ads', failed: true },
      ])
    )
    expect(timing.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: '["query","articles",1]', status: 'hit', loader: 'page' }),
        expect.objectContaining({ key: '["query","menu"]', status: 'hit', loader: 'header' }),
      ])
    )
  })

  it('first build: queries are misses and take the fetch time', async () => {
    const { page } = setup(true)
    const { report } = await page.build(undefined, { trace: true })
    const query = report.trace!.timing!.queries!.find(({ key }) => key.includes('articles'))!

    expect(query.status).toBe('miss')
    expect(query.duration).toBeGreaterThanOrEqual(4)
  })

  it('without AsyncLocalStorage: loader timings only, no queries', async () => {
    const { page } = setup(false)
    const { report } = await page.build(undefined, { trace: true })

    expect(report.trace!.timing!.loaders.length).toBe(3)
    expect(report.trace!.timing).not.toHaveProperty('queries')
  })

  it('queries outside a traced build are not recorded; a normal build has no timing', async () => {
    const { page } = setup(true)
    const result = await page.build()

    expect(result.report.trace).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('timing')
  })

  it('page.section: timing scoped to the section', async () => {
    const { page } = setup(true)
    const { report } = await page.section('header', undefined, { trace: true })

    expect(report.trace!.timing).toMatchObject({ scope: 'header', loaders: [expect.objectContaining({ loader: 'header' })] })
    expect(report.trace!.timing!.queries).toEqual([expect.objectContaining({ key: '["query","menu"]', loader: 'header' })])
  })
})
