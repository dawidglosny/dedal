import { describe, expect, it } from 'vitest'
import { createDedal, select, type Slot } from '../src'
import { bindingMessages, inspect, mergePayloads, pageMessages, querySummary, reportText, searchNodes, searchSummary, selectNodes } from '../src/devtools'

type Contract = {
  grid: { columns?: number }
  card: { size?: 'sm' | 'md' | 'lg'; title?: string; media?: Slot }
  image: { src?: string }
  tabs: { labels?: string[]; content?: Slot[] }
  text: { value?: string }
  skeleton: Record<string, never>
}
type Ctx = { device: 'desktop' | 'mobile' }

const ui = createDedal<Contract>({ defaults: { card: { size: 'md' } } })
const { node, repeat, section } = ui

const home = ui.page<Ctx>({
  sections: [
    section(
      'news',
      node('grid', {
        children: [
          node('card', { alias: 'featured', slots: { media: node('image') } }),
          repeat(node('card', { slots: { media: node('image') } }), 3),
          node('grid', { children: [repeat(node('card'), 2)] }),
        ],
      }),
      { patch: { 'grid > card:nth-child(2)': { size: 'lg' } } }
    ),
    section('tabs', node('tabs', { slots: { content: [node('text'), node('text')] } }), {
      data: async () => ({ text: [{ value: 'a' }, 'nie-obiekt'] }),
    }),
    section('forYou', node('card'), { defer: { fallback: node('skeleton') } }),
  ],
  data: async () => ({
    news: { '#featured': [{ title: 'F' }], 'grid > card': [{ title: 'A' }, { title: 'B' }] },
    ghost: { card: [] },
  }),
})

const build = async (trace = true) => {
  const result = await home.build({ device: 'desktop' }, { trace })
  return { result, payload: inspect(result, ui.resolve(result, { trace })) }
}

describe('inspect', () => {
  it('indeksuje wszystkie węzły ze strukturą', async () => {
    const { payload } = await build()
    const featured = payload.nodes['news.0']

    expect(featured).toMatchObject({
      component: 'card',
      alias: 'featured',
      section: 'news',
      parent: 'news',
      path: [0],
      children: ['news.0:media'],
    })
    expect(payload.nodes['news.0:media']).toMatchObject({ parent: 'news.0', slot: 'media', path: [0, { slot: 'media' }] })
    expect(payload.nodes['tabs:content.1'].path).toEqual([{ slot: 'content', index: 1 }])
  })

  it('propsy z wartością i pochodzeniem', async () => {
    const { payload } = await build()

    expect(payload.nodes['news.1'].props).toEqual({
      size: { value: 'lg', source: { from: 'patch', selector: 'grid > card:nth-child(2)', section: 'news' } },
      title: { value: 'A', source: { from: 'data' } },
    })
    expect(payload.nodes['news.2'].props.size).toEqual({ value: 'md', source: { from: 'default' } })
  })

  it('bez trace: propsy bez pochodzenia, sekcje bez źródła', async () => {
    const { payload } = await build(false)

    expect(payload.nodes['news.1'].props.size).toEqual({ value: 'lg' })
    expect(payload.sections[0]).not.toHaveProperty('source')
    expect(payload.page).not.toHaveProperty('cacheKey')
  })

  it('dane węzła z selektorem, który je przypisał', async () => {
    const { payload } = await build()

    expect(payload.nodes['news.0'].data).toEqual({ value: { title: 'F' }, selector: '#featured' })
    expect(payload.nodes['news.1'].data).toEqual({ value: { title: 'A' }, selector: 'grid > card' })
  })

  it('sekcje: źródło danych, odroczone, raport przypisań', async () => {
    const { payload } = await build()

    expect(payload.sections.map(({ key, source, deferred }) => [key, source, deferred])).toEqual([
      ['news', 'page', undefined],
      ['tabs', 'section', undefined],
      ['forYou', 'deferred', true],
    ])
    expect(payload.sections[0].report?.bindings.map(({ selector }) => selector)).toEqual(['#featured', 'grid > card'])
  })

  it('problemy przy węźle i na poziomie strony', async () => {
    const { payload } = await build()

    expect(payload.nodes['tabs:content.1'].issues).toEqual([expect.stringContaining('is not an object')])
    expect(payload.page.unknownData).toEqual(['ghost'])
  })

  it('sugerowany selektor trafia dokładnie w swój węzeł — dla każdego węzła', async () => {
    const { result, payload } = await build()

    for (const inspected of Object.values(payload.nodes)) {
      const root = result.sections.find(({ key }) => key === inspected.section)!.layout
      const found = select(root, inspected.selector)

      expect(inspected.unique).toBe(true)
      expect(found.map(({ id }) => id)).toEqual([inspected.id])
    }
  })

  it('sugeruje najkrótszy selektor', async () => {
    const { payload } = await build()

    expect(payload.nodes['news.0'].selector).toBe('#featured')
    expect(payload.nodes['tabs'].selector).toBe('tabs')
    expect(payload.nodes['tabs:content.1'].selector).toBe('text:slot(content):nth-child(2)')
    expect(payload.nodes['news.0:media'].selector).toBe('#featured > image:slot(media)')
  })

  it('pomija propsy undefined (np. z toProps)', () => {
    const withUndefined = createDedal<Contract>({ toProps: { card: ({ props }) => ({ ...props, title: undefined }) } })
    const root = withUndefined.layout(withUndefined.node('card'), 'c')
    const result = { dedal: 1 as const, sections: [{ key: 'c', layout: root }], data: {}, report: { sections: {}, unknownData: [], removedSections: [], failedSections: [], emptySections: [] } }
    const payload = inspect(result, withUndefined.resolve(result))

    expect(payload.nodes.c.props).toEqual({})
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('payload przechodzi przez JSON bez zmian', async () => {
    const { payload } = await build()

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })
})

describe('selectNodes', () => {
  it('daje te same węzły co select() z rdzenia', async () => {
    const { result, payload } = await build()
    const root = result.sections[0].layout

    for (const selector of ['card', 'grid > card:nth-child(2)', 'grid grid card', ':root', 'image:slot(media)', '#featured', '[size=lg]']) {
      expect(selectNodes(payload, selector).filter(id => payload.nodes[id].section === 'news')).toEqual(
        select(root, selector).map(({ id }) => id)
      )
    }
  })

  it('obejmuje wszystkie sekcje i rzuca SyntaxError dla złej składni', async () => {
    const { payload } = await build()

    expect(selectNodes(payload, 'text')).toEqual(['tabs:content.0', 'tabs:content.1'])
    expect(() => selectNodes(payload, 'card >')).toThrow(SyntaxError)
  })
})

describe('mergePayloads', () => {
  it('treść sekcji odroczonej zastępuje zaślepkę', async () => {
    const { payload } = await build()
    const sectionResult = await home.section('forYou', { device: 'desktop' })
    const merged = mergePayloads([payload, inspect(sectionResult, ui.resolve(sectionResult))])
    const forYou = merged.sections.find(({ key }) => key === 'forYou')!

    expect(forYou.deferred).toBeUndefined()
    expect(merged.nodes[forYou.root].component).toBe('card')
    expect(merged.sections.map(({ key }) => key)).toEqual(['news', 'tabs', 'forYou'])
    expect(merged.page.unknownData).toEqual(['ghost'])
  })
})

describe('diagnoza danych sekcji', () => {
  const block = node('grid', {
    children: [
      node('card', { alias: 'featured', slots: { media: node('image') } }),
      node('grid', { children: [repeat(node('card', { slots: { media: node('image') } }), 2)] }),
    ],
  })

  async function payloadFor(data: Record<string, unknown>, trace = true) {
    const page = ui.page({ sections: [section('s', block)], data: () => ({ s: data }) as never })
    const result = await page.build(undefined, { trace })
    return inspect(result, ui.resolve(result, { trace }))
  }
  const sectionOf = async (data: Record<string, unknown>, trace = true) => (await payloadFor(data, trace)).sections.find(({ key }) => key === 's')!

  it('selektor bez trafień: utracone dane i poprawiony selektor, który trafia', async () => {
    const { diagnosis } = await sectionOf({
      card: [{ title: 'A' }],
      crad: [{ title: 'B' }, { title: 'C' }],
      '#featurd': [{ title: 'X' }],
      'grid > crad > :slot(media)': [{ src: 'x' }],
      zzz: [{}],
    })

    expect(diagnosis!.unmatched).toEqual([
      { selector: 'crad', lost: 2, reason: 'no-match', suggestions: ['card'], claimedBy: [] },
      { selector: '#featurd', lost: 1, reason: 'no-match', suggestions: ['#featured'], claimedBy: [] },
      { selector: 'grid > crad > :slot(media)', lost: 1, reason: 'no-match', suggestions: ['grid > card > :slot(media)'], claimedBy: [] },
      { selector: 'zzz', lost: 1, reason: 'no-match', suggestions: [], claimedBy: [] },
    ])
  })

  it('selektor trafia, ale węzły zajęły wcześniejsze bindingi — kolejność', async () => {
    const { diagnosis } = await sectionOf({ card: [{ title: 'A' }, { title: 'B' }, { title: 'C' }], '#featured': [{ title: 'X' }] })

    expect(diagnosis!.unmatched).toEqual([{ selector: '#featured', lost: 1, reason: 'claimed', suggestions: [], claimedBy: ['card'] }])
  })

  it('pusty binding bez trafień i sekcja bez problemów — bez diagnozy', async () => {
    expect((await sectionOf({ card: [{ title: 'A' }, { title: 'B' }, { title: 'C' }], crad: [] })).diagnosis).toBeUndefined()
  })

  it('usunięte węzły z bindingiem i dane odrzucone z usuniętym przodkiem', async () => {
    const { diagnosis } = await sectionOf({
      'grid > grid': [null],
      card: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
      image: [{ src: '1' }, { src: '2' }, { src: '3' }],
    })

    expect(diagnosis!.removed).toEqual([{ id: 's.1', by: 'grid > grid' }])
    expect(diagnosis!.dropped).toEqual([
      { id: 's.1.0', with: 's.1' },
      { id: 's.1.1', with: 's.1' },
      { id: 's.1.0:media', with: 's.1' },
      { id: 's.1.1:media', with: 's.1' },
    ])
  })

  it('sekcja usunięta przez dane (literówka w jedynym selektorze) zostaje w payloadzie z layoutem i diagnozą', async () => {
    const payload = await payloadFor({ crad: [{ title: 'A' }] })
    const removed = payload.sections.find(({ key }) => key === 's')!

    expect(payload.page.removedSections).toEqual(['s'])
    expect(removed).toMatchObject({ removed: true, root: 's' })
    expect(removed.diagnosis!.unmatched).toEqual([{ selector: 'crad', lost: 1, reason: 'no-match', suggestions: ['card'], claimedBy: [] }])
    expect(payload.nodes['s.0']).toMatchObject({ component: 'card', alias: 'featured', section: 's' })
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('bez trace sekcja usunięta przez dane nie trafia do payloadu', async () => {
    const payload = await payloadFor({ crad: [{ title: 'A' }] }, false)

    expect(payload.sections).toEqual([])
    expect(payload.page.removedSections).toEqual(['s'])
  })

  it('onEmpty z blokiem: diagnoza na layoucie sprzed zastąpienia, węzły bloku zastępczego bez kolizji', async () => {
    const page = ui.page({
      sections: [section('s', block, { onEmpty: node('text', { props: { value: 'Brak' } }) })],
      data: () => ({ s: { crad: [{ title: 'A' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const payload = inspect(result, ui.resolve(result, { trace: true }))

    expect(payload.sections).toHaveLength(1)
    expect(payload.nodes.s.component).toBe('text')
    expect(payload.sections[0].diagnosis!.unmatched[0].suggestions).toEqual(['card'])
  })
})

describe('bindingMessages', () => {
  const binding = { selector: 'card', matched: 4, assigned: 2, missing: ['s.2', 's.3'], unused: 0, onShortage: 'remove' as const }

  it('with trace: data items for nodes, null items counted', () => {
    expect(bindingMessages({ ...binding, received: 3 }).summary).toBe('3 data items for 4 nodes (1 null)')
  })

  it('without trace: filled nodes (data item count unknown)', () => {
    expect(bindingMessages(binding)).toEqual({
      level: 'warning',
      summary: '2 of 4 nodes filled',
      notes: ["2 nodes removed — nothing to fill them with (onShortage: 'remove'): s.2, s.3"],
      suggestions: [],
    })
  })
})

describe('selectNodes / mergePayloads — fixes', () => {
  it('nodes of sections removed by data are not on the page — skipped unless includeRemoved', async () => {
    const page = ui.page({
      sections: [section('a', node('grid', { children: [node('card')] })), section('gone', node('grid', { children: [node('card')] }))],
      data: () => ({ a: { card: [{ title: 'x' }] }, gone: { crad: [{ title: 'y' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const payload = inspect(result, ui.resolve(result, { trace: true }))

    expect(selectNodes(payload, 'card')).toEqual(['a.0'])
    expect(selectNodes(payload, 'card', { includeRemoved: true })).toEqual(['a.0', 'gone.0'])
  })

  it('the same payload merged twice does not duplicate page issues', () => {
    const payload = {
      devtools: 1 as const,
      sections: [],
      nodes: {},
      page: { unknownData: [], removedSections: [], failedSections: [], emptySections: [], issues: [{ id: 'x', message: 'm' }] },
    }

    expect(mergePayloads([payload, payload]).page.issues).toEqual([{ id: 'x', message: 'm' }])
  })
})

describe('querySummary', () => {
  const timing = { scope: 'page', total: 1, layout: 0, load: 1, assign: 0, loaders: [] }

  it('counts statuses; explains an empty list; undefined without query timings', () => {
    expect(querySummary({ ...timing, queries: [{ key: 'a', status: 'hit', start: 0, duration: 0 }, { key: 'b', status: 'miss', start: 0, duration: 1 }, { key: 'c', status: 'hit', start: 0, duration: 0 }] })).toBe('2 hit · 1 miss')
    expect(querySummary({ ...timing, queries: [] })).toBe('none (no ui.query was called during this build)')
    expect(querySummary(timing)).toBeUndefined()
  })
})

describe('reportText', () => {
  it('page messages, only sections with problems (others counted), timings', async () => {
    const page = ui.page({
      sections: [
        section('ok', node('grid', { children: [node('card')] })),
        section('typo', node('grid', { children: [node('card')] }), { patch: { crad: { size: 'lg' } } }),
      ],
      data: () => ({ ok: { card: [{ title: 'A' }] }, typo: { card: [{ title: 'B' }, { title: 'C' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const text = reportText(inspect(result, ui.resolve(result, { trace: true })), { title: 'report for /home' })

    expect(text.split('\n')[0]).toBe('report for /home')
    expect(text).toContain('! 1 patch / remove selector matches no node')
    expect(text).toContain('section typo — source: page')
    expect(text).toContain('  ! card — 2 data items for 1 node')
    expect(text).toContain('      1 data item not shown — no node left for it:')
    expect(text).toContain('        [1] {"title":"C"}')
    expect(text).toContain('  ! patch “crad” matches no node in this section — it has no effect. Did you mean: card?')
    expect(text).toContain('1 section without problems')
    expect(text).not.toContain('section ok')
    expect(text).toMatch(/timing page build — [\d.]+ ms \(layout [\d.]+ · data loading [\d.]+ · assign [\d.]+\)/)
    expect(text).toContain('  page data')
  })

  it('a clean page', async () => {
    const page = ui.page({ sections: [section('ok', node('card'))], data: () => ({ ok: { card: [{ title: 'A' }] } }) })
    const result = await page.build()
    const text = reportText(inspect(result, ui.resolve(result)))

    expect(text).toContain('  no problems')
    expect(text).toContain('1 section without problems')
  })
})

describe('searchNodes', () => {
  const pagePayload = async () => {
    const page = ui.page({
      sections: [
        section('news', node('grid', { children: [node('card', { alias: 'featured' }), node('card')] })),
        section('excess', node('grid', { children: [node('card')] })),
        section('gone', node('card')),
      ],
      data: () => ({ gone: { crad: [{ title: 'x' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    return inspect(result, ui.resolve(result, { trace: true }))
  }

  it('a section key, an ID, an alias — found as text', async () => {
    const payload = await pagePayload()

    expect(searchNodes(payload, 'excess')).toMatchObject({ bySelector: [], byText: ['excess', 'excess.0'] })
    expect(searchNodes(payload, 'news.1')).toMatchObject({ bySelector: [], byText: ['news.1'] })
    expect(searchNodes(payload, '#featured')).toMatchObject({ bySelector: ['news.0'], byText: [] })
    expect(searchSummary(searchNodes(payload, 'excess'), 'excess').text).toBe('2 nodes with “excess” in the ID / section / alias — highlighted on the page')
  })

  it('a selector: matches, text matches are not duplicated; sections removed by data are skipped', async () => {
    const payload = await pagePayload()

    expect(searchNodes(payload, 'card')).toMatchObject({ bySelector: ['news.0', 'news.1', 'excess.0'], byText: [] })
    expect(searchNodes(payload, 'gone').byText).toEqual([])
  })

  it('nothing found: explained; a syntax error shown only then', async () => {
    const payload = await pagePayload()

    expect(searchSummary(searchNodes(payload, 'xyz'), 'xyz')).toEqual({ text: 'No node matches — not a component, alias, ID, section or data on this page.' })
    expect(searchSummary(searchNodes(payload, 'card >'), 'card >').error).toContain('Selector "card >"')
  })
})

describe('searchNodes: data', () => {
  it('finds nodes by a value in their data (nested too), with the field path; data not on the page by its preview', async () => {
    const page = ui.page({
      sections: [section('news', node('grid', { children: [node('card'), node('card')] }))],
      data: () => ({
        news: {
          card: [
            { title: 'Pierwszy', author: { name: 'Anna Nowak' } },
            { title: 'Krótki tytuł', tags: ['sport'] },
            { title: 'Zgubiony artykuł' },
          ],
        },
      }),
    })
    const result = await page.build(undefined, { trace: true })
    const payload = inspect(result, ui.resolve(result, { trace: true }))

    expect(searchNodes(payload, 'krótki').byData).toEqual([{ id: 'news.1', path: 'title', value: 'Krótki tytuł' }])
    expect(searchNodes(payload, 'nowak').byData).toEqual([{ id: 'news.0', path: 'author.name', value: 'Anna Nowak' }])
    expect(searchNodes(payload, 'sport').byData).toEqual([{ id: 'news.1', path: 'tags[0]', value: 'sport' }])
    expect(searchNodes(payload, 'zgubiony')).toMatchObject({ byData: [], lost: [{ section: 'news', selector: 'card', index: 2 }] })
    expect(searchSummary(searchNodes(payload, 'zgubiony'), 'zgubiony').text).toContain('Found only in data that is not on the page (1).')
    expect(searchSummary(searchNodes(payload, 'krótki'), 'krótki').text).toBe('1 node with “krótki” in their data — highlighted on the page')
    expect(searchNodes(payload, 'k').byData).toEqual([])
  })
})

describe('node issues and required in page messages / report', () => {
  it('node issues: a page message, and per section in the report', async () => {
    const page = ui.page({
      sections: [section('news', node('grid', { children: [node('card')] }))],
      data: () => ({ news: { grid: ['two columns'] as never, card: [{ title: 'A' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const payload = inspect(result, ui.resolve(result, { trace: true }))

    expect(pageMessages(payload)).toContainEqual({
      level: 'error',
      text: '1 node has issues — rendered with layout props only; details in the sections below',
    })
    expect(reportText(payload)).toContain('section news — source: page\n  ✗ grid news: data for "grid" is not an object (got string "two columns")')
  })

  it('required: the section is empty although some nodes got data', async () => {
    const page = ui.page({
      sections: [section('popular', node('grid', { children: [node('text'), node('card')] }), { required: 'card' })],
      data: () => ({ popular: { text: [{ value: 'header' }], card: [] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const payload = inspect(result, ui.resolve(result, { trace: true }))

    expect(pageMessages(payload)).toContainEqual(
      expect.objectContaining({ subject: 'popular', text: "removed — none of the required nodes got data (required, onEmpty: 'remove')" })
    )
  })
})

describe('suggestions for slot names', () => {
  it('a typo in a slot name gets a corrected selector (only when it hits)', async () => {
    const page = ui.page({
      sections: [section('news', node('grid', { children: [repeat(node('card', { slots: { media: node('image') } }), 2)] }))],
      data: () => ({ news: { card: [{ title: 'A' }, { title: 'B' }], 'card > :slot(medai)': [{ src: '1' }, { src: '2' }], 'crad > :slot(mdia)': [{ src: '3' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const { diagnosis } = inspect(result, ui.resolve(result, { trace: true })).sections[0]

    expect(diagnosis!.unmatched.map(({ selector, suggestions }) => ({ selector, suggestions }))).toEqual([
      { selector: 'card > :slot(medai)', suggestions: ['card > :slot(media)'] },
      { selector: 'crad > :slot(mdia)', suggestions: ['card > :slot(media)'] },
    ])
  })
})
