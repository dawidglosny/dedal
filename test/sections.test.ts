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
    forUser: vi.fn(async (userId: string) => [{ title: `dla ${userId}` }]),
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
    data: async (ctx: Ctx) => ({ card: await api.forUser(ctx.userId ?? 'anonim') }),
  })

  return { ui, node, repeat, section, api, menuQuery, header, main, forYou }
}

const titles = (data: Record<string, unknown>) => Object.values(data).map(value => (value as { title?: string; label?: string }).title ?? (value as { label?: string }).label)

describe('ui.query', () => {
  it('cache’uje wynik według klucza z parametrów', async () => {
    const { menuQuery, api } = setup()

    await menuQuery({ service: 'sport' })
    await menuQuery({ service: 'sport' })
    await menuQuery({ service: 'film' })

    expect(api.menu).toHaveBeenCalledTimes(2)
  })

  it('zapytanie bez parametrów można wywołać bez argumentu', async () => {
    const { ui } = setup()
    const fn = vi.fn(async () => ['x'])
    const config = ui.query({ key: () => ['config'], fn })

    expect(await config()).toEqual(['x'])
    await config()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('wynik jest zamrożoną kopią — także przy pierwszym pobraniu', async () => {
    const { ui } = setup()
    const source = { items: [3, 1, 2] }
    const numbers = ui.query({ key: () => ['numbers'], fn: async () => source })

    const first = await numbers()

    expect(() => first.items.sort()).toThrow(TypeError)
    expect(Object.isFrozen(source)).toBe(false)
  })

  it('strona i zapytanie o tym samym kluczu to różne wpisy', async () => {
    const { ui, node, section } = setup()
    const pageLoad = vi.fn(async () => ({ a: { card: [{ title: 'strona' }] } }))
    const menu = ui.query({ key: () => ['same'], fn: async () => 'zapytanie' })
    const home = ui.page({ sections: [section('a', node('card'))], data: pageLoad, cache: { key: () => ['same'] } })

    await home.build()
    expect(await menu()).toBe('zapytanie')
    expect(titles((await home.build()).data)).toEqual(['strona'])
    expect(pageLoad).toHaveBeenCalledTimes(1)
  })

  it('ui.invalidate działa na zapytania i strony', async () => {
    const { ui, menuQuery, api } = setup()

    await menuQuery({ service: 'sport' })
    await ui.invalidate(['menu'])
    await menuQuery({ service: 'sport' })

    expect(api.menu).toHaveBeenCalledTimes(2)
  })
})

describe('loadery sekcji', () => {
  it('wspólna sekcja przynosi dane sama, równolegle z data strony', async () => {
    const { ui, header, main, api } = setup()
    const home = ui.page<Ctx>({ sections: [header, main], data: async () => ({ main: { card: await api.articles() } }) })

    const result = await home.build({ service: 'sport' })

    expect(titles(result.data)).toEqual(['sport 1', 'sport 2', 'a', 'b'])
    expect(result.report.unknownData).toEqual([])
  })

  it('zapytanie w loaderze sekcji dzieli dane między stronami', async () => {
    const { ui, header, main, api } = setup()
    const home = ui.page<Ctx>({ sections: [header, main] })
    const article = ui.page<Ctx>({ sections: [header, main] })

    await home.build({ service: 'sport' })
    await article.build({ service: 'sport' })

    expect(api.menu).toHaveBeenCalledTimes(1)
  })

  it('loader nie jest wywoływany dla sekcji nieobecnej w wariancie ani usuniętej przez remove', async () => {
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

  it('dane sekcji z własnym loaderem zwrócone przez data strony = błąd', async () => {
    const { ui, header } = setup()
    const home = ui.page<Ctx>({ sections: [header], data: () => ({ header: { menu: [] } }) })

    await expect(home.build({ service: 's' })).rejects.toThrow('page data returned data for section "header"')
  })

  it('błąd loadera sekcji przerywa build z kluczem sekcji', async () => {
    const { ui, node, section } = setup()
    const home = ui.page({ sections: [section('ads', node('card'), { data: () => Promise.reject(new Error('timeout')) })] })

    await expect(home.build()).rejects.toThrow('section "ads": loader threw: timeout')
  })

  it('optional: błąd usuwa sekcję i trafia do report.failedSections', async () => {
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

  it('etapy osobno: nieudana opcjonalna sekcja to null w PageData (przechodzi przez JSON)', async () => {
    const { ui, node, section, main } = setup()
    const home = ui.page<Ctx>({
      sections: [main, section('ads', node('card'), { optional: true, data: () => Promise.reject(new Error('x')) })],
    })

    const { sections } = home.layout({ service: 's' })
    const data = JSON.parse(JSON.stringify(await home.load({ service: 's' }))) as PageData
    const result = home.assign(sections, data, { service: 's' })

    expect(data.ads).toBeNull()
    expect(result.report.failedSections).toEqual(['ads'])
  })
})

describe('sekcje odroczone', () => {
  it('build: zaślepka z deferred, loader sekcji nie jest wywoływany', async () => {
    const { ui, main, forYou, api } = setup()
    const home = ui.page<Ctx>({ sections: [main, forYou] })

    const result = await home.build({ service: 's', userId: 'u1' })
    const deferred = result.sections.find(({ key }) => key === 'forYou')

    expect(deferred).toEqual({ key: 'forYou', layout: { id: 'forYou', component: 'skeleton', props: {} }, deferred: true })
    expect(api.forUser).not.toHaveBeenCalled()
  })

  it('page.section buduje samą sekcję z jej loaderem, bez data strony', async () => {
    const { ui, main, forYou } = setup()
    const pageLoad = vi.fn(async () => ({ main: { card: [{ title: 'a' }] } }))
    const home = ui.page<Ctx>({ sections: [main, forYou], data: pageLoad })

    const result = await home.section('forYou', { service: 's', userId: 'u1' })

    expect(result.sections.map(({ key }) => key)).toEqual(['forYou'])
    expect(result.sections[0].deferred).toBeUndefined()
    expect(titles(result.data)).toEqual(['dla u1'])
    expect(pageLoad).not.toHaveBeenCalled()
  })

  it('cache strony nie zależy od użytkownika — część spersonalizowana jest poza wpisem', async () => {
    const { ui, main, forYou, api } = setup()
    const home = ui.page<Ctx>({ sections: [main, forYou], cache: { key: ctx => ['home', ctx.service] } })

    const first = await home.build({ service: 's', userId: 'u1' })
    const second = await home.build({ service: 's', userId: 'u2' })

    expect(second).toBe(first)
    expect(titles((await home.section('forYou', { service: 's', userId: 'u2' })).data)).toEqual(['dla u2'])
    expect(api.forUser).toHaveBeenCalledTimes(1)
  })

  it('dane sekcji odroczonej z data strony = błąd', async () => {
    const { ui, forYou } = setup()
    const home = ui.page<Ctx>({ sections: [forYou], data: () => ({ forYou: { card: [] } }) })

    await expect(home.build({ service: 's' })).rejects.toThrow('deferred section loads its own data')
  })

  it('page.section dla nieznanej sekcji rzuca', async () => {
    const { ui, main } = setup()

    await expect(ui.page<Ctx>({ sections: [main] }).section('nope', { service: 's' })).rejects.toThrow('no section "nope"')
  })

  it('resolve przenosi deferred', async () => {
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

  it('domyślnie usuwa sekcję, która oczekiwała danych i ich nie dostała', async () => {
    const result = await build({}, { item: [] })

    expect(result.sections.map(({ key }) => key)).toEqual(['ads'])
    expect(result.report.removedSections).toEqual(['news'])
    expect(result.report.emptySections).toEqual(['news'])
  })

  it('sekcje statyczne (bez danych) nie podlegają', async () => {
    const result = await build({}, { item: [{ title: 'a' }] })

    expect(result.sections.map(({ key }) => key)).toEqual(['news', 'ads'])
    expect(result.report.emptySections).toEqual([])
  })

  it("'keep' zostawia pustą sekcję, ale raportuje ją jako pustą", async () => {
    const result = await build({ onEmpty: 'keep' }, { item: [] })

    expect(result.sections.map(({ key }) => key)).toEqual(['news', 'ads'])
    expect(result.report.emptySections).toEqual(['news'])
    expect(result.report.removedSections).toEqual([])
  })

  it("'error' rzuca z kluczem sekcji", async () => {
    await expect(build({ onEmpty: 'error' }, { item: [] })).rejects.toThrow('section "news": no node got data')
  })

  it('blok zastępuje pustą sekcję (stan pusty)', async () => {
    const result = await build({ onEmpty: node('empty-state', { props: { text: 'Brak wyników' } }) }, { item: [] })

    expect(result.sections[0]).toEqual({ key: 'news', layout: { id: 'news', component: 'empty-state', props: { text: 'Brak wyników' } } })
    expect(result.report.emptySections).toEqual(['news'])
  })

  it('required: sekcja jest pusta, gdy dane dostał tylko węzeł spoza required', async () => {
    const withTitle = { list: [{ title: 'Nagłówek' }], item: [] }

    expect((await build({}, withTitle)).sections.map(({ key }) => key)).toEqual(['news', 'ads'])
    expect((await build({ required: 'item' }, withTitle)).sections.map(({ key }) => key)).toEqual(['ads'])
    expect(titles((await build({ required: 'item' }, { ...withTitle, item: [{ title: 'x' }] })).data)).toContain('Nagłówek')
  })

  it('loader sekcji zwracający puste listy też usuwa sekcję', async () => {
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
