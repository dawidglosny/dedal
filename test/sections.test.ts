import { describe, expect, it, vi } from 'vitest'
import { createDedal, type PageData } from '../src'

type Contract = {
  container: { tone?: string }
  menu: { label?: string }
  card: { title?: string }
  skeleton: Record<string, never>
}
type Ctx = { service: string; device?: 'desktop' | 'mobile'; userId?: string }

const setup = () => {
  const ui = createDedal<Contract>()
  const { node, repeat, section } = ui
  const api = {
    menu: vi.fn(async (service: string) => ({ items: [{ label: `${service} 1` }, { label: `${service} 2` }] })),
    articles: vi.fn(async () => [{ title: 'a' }, { title: 'b' }]),
    forUser: vi.fn(async (userId: string) => [{ title: `for ${userId}` }]),
  }

  const menuQuery = ui.query({
    key: ({ service }: { service: string }) => ['menu', service],
    fn: ({ service }) => api.menu(service),
  })

  const header = section('header', node('container', { children: [repeat(node('menu'), 2)] }), {
    data: async (ctx: Ctx) => ({ menu: (await menuQuery({ service: ctx.service })).items }),
  })
  const main = section('main', node('container', { children: [repeat(node('card'), 2)] }))
  const forYou = section('forYou', node('container', { children: [node('card')] }), {
    defer: { fallback: node('skeleton') },
    data: async (ctx: Ctx) => ({ card: await api.forUser(ctx.userId ?? 'anonymous') }),
  })

  return { ui, node, repeat, section, api, menuQuery, header, main, forYou }
}

const titles = (data: Record<string, unknown>) => Object.values(data).map(value => (value as { title?: string; label?: string }).title ?? (value as { label?: string }).label)

describe('ui.query', () => {
  it('caches the result by a key built from params', async () => {
    const { menuQuery, api } = setup()

    await menuQuery({ service: 'sport' })
    await menuQuery({ service: 'sport' })
    await menuQuery({ service: 'film' })

    expect(api.menu).toHaveBeenCalledTimes(2)
  })

  it('a query without params can be called without an argument', async () => {
    const { ui } = setup()
    const fn = vi.fn(async () => ['x'])
    const config = ui.query({ key: () => ['config'], fn })

    expect(await config()).toEqual(['x'])
    await config()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('the result is a frozen copy — also on the first fetch', async () => {
    const { ui } = setup()
    const source = { items: [3, 1, 2] }
    const numbers = ui.query({ key: () => ['numbers'], fn: async () => source })

    const first = await numbers()

    expect(() => first.items.sort()).toThrow(TypeError)
    expect(Object.isFrozen(source)).toBe(false)
  })

  it('a page and a query with the same key are separate entries', async () => {
    const { ui, node, section } = setup()
    const pageLoad = vi.fn(async () => ({ a: { card: [{ title: 'page' }] } }))
    const menu = ui.query({ key: () => ['same'], fn: async () => 'query' })
    const home = ui.page({ sections: [section('a', node('card'))], data: pageLoad, cache: { key: () => ['same'] } })

    await home.build()
    expect(await menu()).toBe('query')
    expect(titles((await home.build()).data)).toEqual(['page'])
    expect(pageLoad).toHaveBeenCalledTimes(1)
  })

  it('ui.invalidate works on queries and pages', async () => {
    const { ui, menuQuery, api } = setup()

    await menuQuery({ service: 'sport' })
    await ui.invalidate(['menu'])
    await menuQuery({ service: 'sport' })

    expect(api.menu).toHaveBeenCalledTimes(2)
  })
})

describe('section loaders', () => {
  it('a shared section fetches its own data, in parallel with the page data', async () => {
    const { ui, header, main, api } = setup()
    const home = ui.page<Ctx>({ sections: [header, main], data: async () => ({ main: { card: await api.articles() } }) })

    const result = await home.build({ service: 'sport' })

    expect(titles(result.data)).toEqual(['sport 1', 'sport 2', 'a', 'b'])
    expect(result.report.unknownData).toEqual([])
  })

  it('a query in a section loader shares data across pages', async () => {
    const { ui, header, main, api } = setup()
    const home = ui.page<Ctx>({ sections: [header, main] })
    const article = ui.page<Ctx>({ sections: [header, main] })

    await home.build({ service: 'sport' })
    await article.build({ service: 'sport' })

    expect(api.menu).toHaveBeenCalledTimes(1)
  })

  it('the loader is not called for a section absent from the variant or removed by remove', async () => {
    const { ui, node, section, main } = setup()
    const desktopOnly = vi.fn(async () => ({ card: [{ title: 'x' }] }))
    const removed = vi.fn(async () => ({ card: [{ title: 'y' }] }))
    const home = ui.page<Ctx>({
      sections: ({ device }) => [
        main,
        ...(device === 'desktop' ? [section('side', node('card'), { data: desktopOnly })] : []),
        section('gone', node('card'), { remove: 'card', data: removed }),
      ],
    })

    const result = await home.build({ service: 's', device: 'mobile' })

    expect(desktopOnly).not.toHaveBeenCalled()
    expect(removed).not.toHaveBeenCalled()
    expect(result.report.removedSections).toEqual(['gone'])
  })

  it('data for a section with its own loader returned by the page data = error', async () => {
    const { ui, header } = setup()
    const home = ui.page<Ctx>({ sections: [header], data: () => ({ header: { menu: [] } }) })

    await expect(home.build({ service: 's' })).rejects.toThrow('page data returned data for section "header"')
  })

  it('a section loader error aborts build with the section key', async () => {
    const { ui, node, section } = setup()
    const home = ui.page({ sections: [section('ads', node('card'), { data: () => Promise.reject(new Error('timeout')) })] })

    await expect(home.build()).rejects.toThrow('section "ads": loader threw: timeout')
  })

  it('optional: an error removes the section and is listed in report.failedSections', async () => {
    const { ui, node, section, main } = setup()
    const onSectionError = vi.fn()
    const home = ui.page<Ctx>({
      sections: [main, section('ads', node('card'), { optional: true, data: () => Promise.reject(new Error('timeout')) })],
      onSectionError,
    })

    const result = await home.build({ service: 's' })

    expect(result.sections.map(({ key }) => key)).toEqual(['main'])
    expect(result.report.failedSections).toEqual(['ads'])
    expect(onSectionError).toHaveBeenCalledWith(expect.any(Error), { section: 'ads' })
  })

  it('separate stages: a failed optional section is null in PageData (survives JSON)', async () => {
    const { ui, node, section, main } = setup()
    const home = ui.page<Ctx>({
      sections: [main, section('ads', node('card'), { optional: true, data: () => Promise.reject(new Error('x')) })],
    })

    const { sections } = await home.layout({ service: 's' })
    const data = JSON.parse(JSON.stringify(await home.load({ service: 's' }))) as PageData
    const result = await home.assign(sections, data, { service: 's' })

    expect(data.ads).toBeNull()
    expect(result.report.failedSections).toEqual(['ads'])
  })
})

describe('deferred sections', () => {
  it('build: fallback from deferred, the section loader is not called', async () => {
    const { ui, main, forYou, api } = setup()
    const home = ui.page<Ctx>({ sections: [main, forYou] })

    const result = await home.build({ service: 's', userId: 'u1' })
    const deferred = result.sections.find(({ key }) => key === 'forYou')

    expect(deferred).toEqual({ key: 'forYou', layout: { id: 'forYou', component: 'skeleton', props: {} }, deferred: true })
    expect(api.forUser).not.toHaveBeenCalled()
  })

  it('page.section builds just the section with its loader, without the page data', async () => {
    const { ui, main, forYou } = setup()
    const pageLoad = vi.fn(async () => ({ main: { card: [{ title: 'a' }] } }))
    const home = ui.page<Ctx>({ sections: [main, forYou], data: pageLoad })

    const result = await home.section('forYou', { service: 's', userId: 'u1' })

    expect(result.sections.map(({ key }) => key)).toEqual(['forYou'])
    expect(result.sections[0].deferred).toBeUndefined()
    expect(titles(result.data)).toEqual(['for u1'])
    expect(pageLoad).not.toHaveBeenCalled()
  })

  it('the page cache does not depend on the user — the personalized part is outside the entry', async () => {
    const { ui, main, forYou, api } = setup()
    const home = ui.page<Ctx>({ sections: [main, forYou], cache: { key: ctx => ['home', ctx.service] } })

    const first = await home.build({ service: 's', userId: 'u1' })
    const second = await home.build({ service: 's', userId: 'u2' })

    expect(second).toBe(first)
    expect(titles((await home.section('forYou', { service: 's', userId: 'u2' })).data)).toEqual(['for u2'])
    expect(api.forUser).toHaveBeenCalledTimes(1)
  })

  it('deferred section data from the page data = error', async () => {
    const { ui, forYou } = setup()
    const home = ui.page<Ctx>({ sections: [forYou], data: () => ({ forYou: { card: [] } }) })

    await expect(home.build({ service: 's' })).rejects.toThrow('deferred section loads its own data')
  })

  it('page.section throws for an unknown section', async () => {
    const { ui, main } = setup()

    await expect(ui.page<Ctx>({ sections: [main] }).section('nope', { service: 's' })).rejects.toThrow('no section "nope"')
  })

  it('resolve carries deferred over', async () => {
    const { ui, main, forYou } = setup()
    const resolved = ui.resolve(await ui.page<Ctx>({ sections: [main, forYou] }).build({ service: 's' }))

    expect(resolved.sections.map(({ key, deferred }) => [key, deferred])).toEqual([
      ['main', undefined],
      ['forYou', true],
    ])
  })
})

describe('onEmpty', () => {
  type Empty = { list: { title?: string }; item: { title?: string }; banner: Record<string, never>; 'empty-state': { text?: string } }
  const ui = createDedal<Empty>()
  const { node, repeat, section } = ui
  const listBlock = node('list', { children: [repeat(node('item'), 3)] })
  const titles = (layout: unknown) => JSON.stringify(layout)

  const build = (options: Parameters<typeof section>[2], data: Record<string, unknown>) =>
    ui.page({ sections: [section('news', listBlock, options), section('ads', node('banner'))], data: () => ({ news: data }) as never }).build()

  it('by default removes a section that expected data and got none', async () => {
    const result = await build({}, { item: [] })

    expect(result.sections.map(({ key }) => key)).toEqual(['ads'])
    expect(result.report.removedSections).toEqual(['news'])
    expect(result.report.emptySections).toEqual(['news'])
  })

  it('static sections (without data) are not affected', async () => {
    const result = await build({}, { item: [{ title: 'a' }] })

    expect(result.sections.map(({ key }) => key)).toEqual(['news', 'ads'])
    expect(result.report.emptySections).toEqual([])
  })

  it("'keep' keeps the empty section but reports it as empty", async () => {
    const result = await build({ onEmpty: 'keep' }, { item: [] })

    expect(result.sections.map(({ key }) => key)).toEqual(['news', 'ads'])
    expect(result.report.emptySections).toEqual(['news'])
    expect(result.report.removedSections).toEqual([])
  })

  it("'error' throws with the section key", async () => {
    await expect(build({ onEmpty: 'error' }, { item: [] })).rejects.toThrow('section "news": no node got data')
  })

  it('a block replaces the empty section (empty state)', async () => {
    const result = await build({ onEmpty: node('empty-state', { props: { text: 'No results' } }) }, { item: [] })

    expect(result.sections[0]).toEqual({ key: 'news', layout: { id: 'news', component: 'empty-state', props: { text: 'No results' } } })
    expect(result.report.emptySections).toEqual(['news'])
  })

  it('required: the section is empty when only a node outside required got data', async () => {
    const withTitle = { list: [{ title: 'Heading' }], item: [] }

    expect((await build({}, withTitle)).sections.map(({ key }) => key)).toEqual(['news', 'ads'])
    expect((await build({ required: 'item' }, withTitle)).sections.map(({ key }) => key)).toEqual(['ads'])
    expect(titles((await build({ required: 'item' }, { ...withTitle, item: [{ title: 'x' }] })).data)).toContain('Heading')
  })

  it('a section loader returning empty lists also removes the section', async () => {
    const result = await ui.page({ sections: [section('news', listBlock, { data: async () => ({ item: [] }) })] }).build()

    expect(result.sections).toEqual([])
    expect(result.report.removedSections).toEqual(['news'])
  })
})

describe('section data and layout errors', () => {
  type C = { grid: Record<string, never>; card: { title?: string } }
  const ui2 = createDedal<C>()
  const block = ui2.node('grid', { children: [ui2.node('card')] })

  it('loader returning an array: error names the section and the expected shape', async () => {
    const page = ui2.page({ sections: [ui2.section('s', block, { data: async () => [{ title: 'a' }] as never })] })

    await expect(page.build()).rejects.toThrow('section "s": data must be an object { selector: items } (e.g. { card: [...] }), got array (1 items)')
  })

  it('selector syntax error in patch / remove names the section', async () => {
    const patched = ui2.page({ sections: [ui2.section('s', block, { patch: { 'card >': { title: 'x' } } })] })
    const removed = ui2.page({ sections: [ui2.section('s', block, { remove: 'card >' })] })

    await expect(patched.build()).rejects.toThrow('section "s": Selector "card >"')
    await expect(removed.build()).rejects.toThrow('section "s": Selector "card >"')
  })

  it('trace: remove / patch selectors with the number of matched nodes', async () => {
    const page = ui2.page({ sections: [ui2.section('s', block, { remove: ['crad', 'card'], patch: { grid: { }, crad: { title: 'x' } } })] })
    const { report } = await page.build(undefined, { trace: true })

    expect(report.trace!.layoutSelectors).toEqual({
      s: [
        { kind: 'remove', selector: 'crad', matched: 0 },
        { kind: 'remove', selector: 'card', matched: 1 },
        { kind: 'patch', selector: 'grid', matched: 1 },
        { kind: 'patch', selector: 'crad', matched: 0 },
      ],
    })
    expect((await page.build()).report.trace).toBeUndefined()
  })
})
