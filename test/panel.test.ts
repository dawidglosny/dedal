// @vitest-environment happy-dom
import { AsyncLocalStorage } from 'node:async_hooks'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDedal, type Slot } from '../src'
import { inspect } from '../src/devtools'
import { mountDevtools } from '../src/devtools/panel'
import { DevtoolsData, Render, type Registry } from '../src/react'

type Contract = { grid: Record<string, never>; card: { title?: string } }

const ui = createDedal<Contract>()
const { node, repeat, section } = ui
const registry = {
  grid: ({ children }) => createElement('div', { class: 'grid' }, children),
  card: ({ title }) => createElement('a', null, title),
} satisfies Registry<Contract>

const home = ui.page({
  sections: [section('news', node('grid', { children: [repeat(node('card'), 2)] }))],
  data: () => ({ news: { card: [{ title: '<img src=x onerror=alert(1)>' }, { title: 'B' }] } }),
})

/** Page as in the app: render in debug mode + devtools payload. */
async function renderPage() {
  const result = await home.build(undefined, { trace: true })
  const resolved = ui.resolve(result, { trace: true })
  document.body.innerHTML = renderToStaticMarkup(
    createElement('main', null, createElement(Render<Contract>, { tree: resolved, registry, debug: true }), createElement(DevtoolsData, { payload: inspect(result, resolved) }))
  )
}

const shadow = () => document.querySelector('#dedal-devtools')!.shadowRoot!
const text = () => shadow().querySelector('.body')!.textContent ?? ''
/** The pick button while picking (active). */
const activePick = () => [...shadow().querySelectorAll('button.active')].find(element => element.textContent === 'pick')
const button = (label: string) => [...shadow().querySelectorAll('button')].find(element => element.textContent === label)!

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  dispose = undefined
  sessionStorage.clear()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mountDevtools', () => {
  it('mounts the panel in Shadow DOM; a repeated call does not duplicate it', async () => {
    await renderPage()
    dispose = mountDevtools()

    expect(mountDevtools()).toBe(dispose)
    expect(document.querySelectorAll('#dedal-devtools')).toHaveLength(1)
    expect(shadow().querySelector('.toggle')!.textContent).toBe('dedal')
  })

  it('picking a page element shows the node: selector, props source, data', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    document.querySelector('a')!.click()

    expect(text()).toContain('card')
    expect(text()).toContain('news.0')
    expect(text()).toContain('card:nth-child(1)')
    expect(text()).toContain('← data')
    expect(text()).toContain('assigned by card')
  })

  it('page data reaches the panel as text, not HTML', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    document.querySelector('a')!.click()

    expect(text()).toContain('<img src=x onerror=alert(1)>')
    expect(shadow().querySelector('img')).toBeNull()
  })

  it('the tree shows sections and nodes', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })

    button('tree').click()

    expect(text()).toContain('section news')
    expect(text()).toContain('grid news')
    expect(text()).toContain('card news.1')
  })

  it('tree with a selector filter: matches highlighted, others dimmed, syntax error shown', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })

    button('tree').click()
    const input = shadow().querySelector('input')!
    input.value = 'grid > card'
    input.dispatchEvent(new Event('input'))
    expect(text()).toContain('2 nodes match the selector — highlighted on the page')
    expect(shadow().querySelectorAll('.row.match')).toHaveLength(2)
    expect(shadow().querySelectorAll('.row.dim')).toHaveLength(1)

    input.value = 'card >'
    input.dispatchEvent(new Event('input'))
    expect(shadow().querySelector('.err')!.textContent).toContain('Selector "card >"')
  })

  it('a payload streamed in later (deferred section) reaches the panel', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })
    button('tree').click()

    const later = ui.page({ sections: [section('forYou', node('card'))], data: () => ({ forYou: { card: [{ title: 'X' }] } }) })
    const result = await later.build()
    const holder = document.createElement('div')
    holder.innerHTML = renderToStaticMarkup(createElement(DevtoolsData, { payload: inspect(result, ui.resolve(result)) }))
    document.body.append(holder)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(text()).toContain('section forYou')
  })

  it('unmounting removes the panel', async () => {
    await renderPage()
    dispose = mountDevtools()
    dispose()
    dispose = undefined

    expect(document.querySelector('#dedal-devtools')).toBeNull()
  })
})

// --- page with the full set of states: alias, slot, node problems, failed / removed / empty sections, data without a section

type RichContract = { grid: Record<string, never>; card: { title?: string }; media: { cover?: Slot } }

const rich = createDedal<RichContract>()

const richPage = rich.page({
  sections: [
    rich.section(
      'news',
      rich.node('grid', {
        alias: 'main',
        children: [rich.repeat(rich.node('card'), 2), rich.node('media', { slots: { cover: rich.node('card') } })],
      })
    ),
    rich.section('broken', rich.node('card'), {
      optional: true,
      data: async () => {
        throw new Error('timeout')
      },
    }),
    rich.section('gone', rich.node('card'), { remove: ':root' }),
    rich.section('quiet', rich.node('grid', { children: [rich.node('card')] }), { onEmpty: 'keep' }),
  ],
  data: () => ({
    // 3 data items for 2 cards (surplus), data of the card in the slot is not an object (node problem)
    news: { 'grid > card': [{ title: 'A' }, { title: 'B' }, { title: 'C' }], 'media > :slot(cover)': ['plain text'] },
    quiet: { card: [] },
    ghost: { card: [{ title: 'no section' }] },
  }),
})

async function renderRichPage() {
  const result = await richPage.build(undefined, { trace: true })
  const resolved = rich.resolve(result, { trace: true })
  document.body.innerHTML = renderToStaticMarkup(
    createElement(
      'main',
      null,
      createElement(Render<RichContract>, {
        tree: resolved,
        registry: {
          grid: ({ children }) => createElement('div', null, children),
          card: ({ title }) => createElement('a', null, title),
          media: ({ cover }) => createElement('figure', null, cover),
        } satisfies Registry<RichContract>,
        debug: true,
      }),
      createElement(DevtoolsData, { payload: inspect(result, resolved) })
    )
  )
  return result
}

/** Payload appended manually (e.g. from another island / stream). */
function appendPayload(json: string) {
  const script = document.createElement('script')
  script.type = 'application/json'
  script.setAttribute('data-dedal-devtools', '')
  script.textContent = json
  document.body.append(script)
}

const markerOf = (id: string) => document.querySelector(`dedal-node[data-dedal-key="${id}"]`)!
const row = (fragment: string) => [...shadow().querySelectorAll('.row')].find(element => element.textContent?.includes(fragment)) as HTMLElement
const link = (fragment: string) => [...shadow().querySelectorAll('.link')].find(element => element.textContent?.includes(fragment)) as HTMLElement
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

/** happy-dom doesn't compute layout — a fixed rect for every range so the highlight has a box. */
const withLayout = () =>
  vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 40, width: 100, height: 20 } as DOMRect)

describe('panel: toggle', () => {
  it('closed by default: the button opens and closes the panel', async () => {
    await renderPage()
    dispose = mountDevtools()
    const panel = shadow().querySelector('.panel') as HTMLElement

    expect(panel.hidden).toBe(true)
    expect(text()).toBe('')

    ;(shadow().querySelector('.toggle') as HTMLElement).click()
    expect(panel.hidden).toBe(false)
    expect(text()).toContain('Click “pick”')

    ;(shadow().querySelector('.toggle') as HTMLElement).click()
    expect(panel.hidden).toBe(true)
  })

  it('invalid JSON in a payload is skipped', async () => {
    await renderPage()
    appendPayload('{ not json')
    dispose = mountDevtools({ open: true })

    button('tree').click()
    expect(text()).toContain('section news')
  })
})

describe('panel: picking', () => {
  it('Esc cancels picking and restores the highlight of the selected node', async () => {
    await renderPage()
    withLayout()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    expect(activePick()).toBeDefined()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(button('pick')).toBeDefined()
    expect(shadow().querySelectorAll('.box')).toHaveLength(0)
  })

  it('mouse movement while picking highlights the node with a label; outside a node — clears it', async () => {
    await renderPage()
    withLayout()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    document.querySelector('a')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    expect(shadow().querySelectorAll('.box')).toHaveLength(1)
    expect(shadow().querySelector('.label')!.textContent).toBe('card news.0')

    document.querySelector('main')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    expect(shadow().querySelectorAll('.box')).toHaveLength(0)
  })

  it('a click outside a node ends picking without selecting; clicks are not intercepted when not picking', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    const outside = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.querySelector('main')!.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(true)
    expect(button('pick')).toBeDefined()
    expect(text()).toContain('Click “pick”')

    const normal = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.querySelector('a')!.dispatchEvent(normal)
    expect(normal.defaultPrevented).toBe(false)
  })

  it('events from the panel itself are not treated as picking on the page', async () => {
    await renderPage()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    button('tree').click()

    expect(activePick()).toBeDefined()
    expect(text()).toContain('section news')
  })
})

describe('panel: node and tree', () => {
  it('tree: alias, slot, data and issue markers; clicking a row selects the node', async () => {
    await renderRichPage()
    dispose = mountDevtools({ open: true })

    button('tree').click()
    expect(row('grid #main').textContent).toBe('grid #main news')
    expect(row(':slot(cover)').textContent).toContain('!')
    expect(row('card news.0').textContent).toContain('●')

    row('card news.0').click()
    expect(text()).toContain('assigned by grid > card')
    expect(shadow().querySelector('.head button.active')!.textContent).toBe('node')

    button('tree').click()
    expect(row('card news.0').className).toBe('row active')
  })

  it('node view: issues, navigation to parent and children', async () => {
    await renderRichPage()
    dispose = mountDevtools({ open: true })

    button('pick').click()
    ;(markerOf('news.2:cover') as HTMLElement).click()

    expect(text()).toContain('slot cover')
    expect(text()).toContain('issues')
    expect(text()).toContain('is not an object')

    link('media').click()
    expect(text()).toContain('media')
    expect(text()).toContain('children')

    link('grid news').click()
    expect(text()).toContain('#main')
    expect(text()).toContain('card news.0')
  })

  it('hovering a link highlights the node; scrolling refreshes the highlight', async () => {
    await renderRichPage()
    const rect = withLayout()
    dispose = mountDevtools({ open: true })

    button('tree').click()
    row('card news.0').dispatchEvent(new MouseEvent('mouseenter'))
    expect(shadow().querySelectorAll('.box')).toHaveLength(1)

    rect.mockReturnValue({ left: 10, top: 5, width: 100, height: 20 } as DOMRect)
    window.dispatchEvent(new Event('scroll'))
    expect((shadow().querySelector('.box') as HTMLElement).style.top).toBe('5px')
  })

  it('a node without a box (zero rect) gets no outline', async () => {
    await renderRichPage()
    dispose = mountDevtools({ open: true })

    button('tree').click()
    row('card news.0').dispatchEvent(new MouseEvent('mouseenter'))
    expect(shadow().querySelectorAll('.box')).toHaveLength(0)
  })

  it('“copy” writes the node selector to the clipboard', async () => {
    await renderPage()
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    dispose = mountDevtools({ open: true })

    button('pick').click()
    document.querySelector('a')!.click()
    button('copy').click()

    expect(writeText).toHaveBeenCalledWith('card:nth-child(1)')
    vi.unstubAllGlobals()
  })
})

describe('panel: sections', () => {
  it('page state: cache, failed / removed / empty sections, data without a section, page issues', async () => {
    await renderRichPage()
    appendPayload(
      JSON.stringify({
        devtools: 1,
        sections: [],
        nodes: {},
        page: { unknownData: [], removedSections: [], failedSections: [], emptySections: [], issues: [{ id: 'x.9', message: 'data for an ID that has no node in the layout' }] },
      })
    )
    dispose = mountDevtools({ open: true })

    button('sections').click()
    expect(text()).toContain('· cache key: none — the page has no cache option')
    expect(text()).toContain('✗ broken failed — the loader threw "timeout"; the section is skipped (optional: true)')
    expect(text()).toContain("! gone removed — the section's remove option removed its root")
    expect(text()).toContain("! quiet empty — no node got data; kept as is (onEmpty: 'keep')")
    expect(text()).toContain('! ghost unknownData — data returned for a section that is not on this page')
    expect(text()).toContain('✗ x.9 data for an ID that has no node in the layout')
  })

  it('section bindings: assigned / matched, surplus; a click opens the selector with that query', async () => {
    await renderRichPage()
    withLayout()
    dispose = mountDevtools({ open: true })

    button('sections').click()
    const binding = row('grid > card')
    expect(binding.textContent).toBe('! grid > card — 3 data items for 2 nodes')
    expect(text()).toContain('1 data item not shown — no node left for it:')

    binding.dispatchEvent(new MouseEvent('mouseenter'))
    expect(shadow().querySelectorAll('.box.multi')).toHaveLength(2)

    binding.click()
    await tick()
    expect((shadow().querySelector('input') as HTMLInputElement).value).toBe('grid > card')
    expect(text()).toContain('2 node')
  })

  it('a section with a cache key and a binding without data', async () => {
    const cached = rich.page({
      cache: { key: () => ['home'] },
      sections: [rich.section('list', rich.node('grid', { children: [rich.repeat(rich.node('card'), 2)] }))],
      data: () => ({ list: { card: { items: [{ title: 'A' }], onShortage: 'keep' } } }),
    })
    const result = await cached.build(undefined, { trace: true })
    const resolved = rich.resolve(result, { trace: true })
    document.body.innerHTML = renderToStaticMarkup(createElement(DevtoolsData, { payload: inspect(result, resolved) }))
    dispose = mountDevtools({ open: true })

    button('sections').click()
    expect(text()).toContain('["page","home"]')
    expect(text()).toContain("1 node left empty (onShortage: 'keep'): list.1")
  })
})

describe('panel: tree filter', () => {
  it('an empty query clears the results and the highlight', async () => {
    await renderPage()
    withLayout()
    dispose = mountDevtools({ open: true })

    button('tree').click()
    const input = shadow().querySelector('input')!
    input.value = 'card'
    input.dispatchEvent(new Event('input'))
    expect(shadow().querySelectorAll('.box.multi')).toHaveLength(2)

    input.value = '  '
    input.dispatchEvent(new Event('input'))
    expect(text()).not.toContain('highlighted on the page')
    expect(shadow().querySelectorAll('.row.match, .row.dim')).toHaveLength(0)
    expect(shadow().querySelectorAll('.box')).toHaveLength(0)
  })

  it('only matches: matches with their ancestors; the former selector tab opens the tree', async () => {
    await renderPage()
    sessionStorage.setItem('dedal-devtools', JSON.stringify({ open: true, tab: 'selector', side: 'right' }))
    dispose = mountDevtools()

    expect(shadow().querySelector('.head button.active')!.textContent).toBe('tree')
    const [input, only] = [...shadow().querySelectorAll('input')] as HTMLInputElement[]
    input.value = 'card:first-child'
    input.dispatchEvent(new Event('input'))
    only.checked = true
    only.dispatchEvent(new Event('change'))

    const rows = [...shadow().querySelectorAll('.row')].map(row => row.textContent)
    expect(rows).toEqual(['grid news', 'card news.0 ●'])
  })
})

describe('panel: props source', () => {
  it('props from defaults and from the block have a source label', async () => {
    const withDefaults = createDedal<Contract>({ defaults: { card: { title: 'default title' } } })
    const page = withDefaults.page({ sections: [withDefaults.section('s', withDefaults.node('grid', { children: [withDefaults.node('card')] }))] })
    const result = await page.build(undefined, { trace: true })
    const resolved = withDefaults.resolve(result, { trace: true })
    document.body.innerHTML = renderToStaticMarkup(
      createElement('main', null, createElement(Render<Contract>, { tree: resolved, registry, debug: true }), createElement(DevtoolsData, { payload: inspect(result, resolved) }))
    )
    dispose = mountDevtools({ open: true })

    button('pick').click()
    document.querySelector('a')!.click()

    expect(text()).toContain('title: "default title" ← default')
  })
})

describe('panel: data mismatches', () => {
  async function renderMismatch() {
    const page = ui.page({
      sections: [
        section('news', node('grid', { children: [repeat(node('card'), 2), node('grid', { alias: 'more', children: [node('card')] })] })),
        section('promo', node('grid', { children: [node('card')] })),
      ],
      data: () => ({
        news: {
          '#more': [null],
          card: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'lost' }],
          crad: [{ title: 'X' }],
        },
        promo: { crads: [{ title: 'P' }] },
      }),
    })
    const result = await page.build(undefined, { trace: true })
    const resolved = ui.resolve(result, { trace: true })
    document.body.innerHTML = renderToStaticMarkup(
      createElement('main', null, createElement(Render<Contract>, { tree: resolved, registry, debug: true }), createElement(DevtoolsData, { payload: inspect(result, resolved) }))
    )
  }

  it('a binding with no matches: in red, the lost data count, the hint opens the selector', async () => {
    await renderMismatch()
    dispose = mountDevtools({ open: true })
    button('sections').click()

    expect(text()).toContain('✗ 2 bindings match no node — 2 data items not shown; details in the sections below')
    expect(row('crad').className).toBe('row err')
    expect(row('crad').textContent).toBe('✗ crad — 1 data item for 0 nodes')
    expect(text()).toContain('No node in this section matches “crad” — the data is not shown. Did you mean: card?')

    link('card').click()
    await tick()
    expect((shadow().querySelector('input') as HTMLInputElement).value).toBe('card')
  })

  it('lost data with index and preview; removed nodes and dropped data with a reason', async () => {
    await renderMismatch()
    dispose = mountDevtools({ open: true })
    button('sections').click()

    expect(text()).toContain('1 data item not shown — no node left for it:')
    expect(text()).toContain('[3] {"title":"lost"}')
    expect(text()).not.toContain('[2] {')
    expect(text()).toContain("1 node removed — nothing to fill it with (onShortage: 'remove'): news.2")
    expect(text()).toContain('news.2.0 had data, but their parent news.2 was removed (nothing to fill it with) — the data is not shown.')
  })

  it('a section removed by data: in sections and in the tree, with the layout before assignment', async () => {
    await renderMismatch()
    dispose = mountDevtools({ open: true })

    button('sections').click()
    expect(text()).toContain('section promo (removed — no data; layout before assign)')
    expect(text()).toContain("! promo removed — no node got data (onEmpty: 'remove'); see the unmatched binding(s) below")
    expect(text()).toContain('No node in this section matches “crad” — the data is not shown. Did you mean: card?')

    button('tree').click()
    expect(text()).toContain('section promo (removed — no data; layout before assign)')
    expect(row('card promo.0')).toBeDefined()
  })
})

describe('panel: counts in messages', () => {
  it('sum of unused across all bindings without matches', async () => {
    const page = ui.page({
      sections: [section('a', node('grid', { children: [node('card')] }))],
      data: () => ({ a: { card: [{ title: 'ok' }], crad: Array.from({ length: 5 }, (_, i) => ({ title: String(i) })), cadr: [{ title: 'x' }, { title: 'y' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    document.body.innerHTML = renderToStaticMarkup(createElement(DevtoolsData, { payload: inspect(result, ui.resolve(result, { trace: true })) }))
    dispose = mountDevtools({ open: true })
    button('sections').click()

    expect(text()).toContain('✗ 2 bindings match no node — 7 data items not shown')
    expect(text()).toContain('No node in this section matches “crad” — the data is not shown.')
    expect(text()).toContain('No node in this section matches “cadr” — the data is not shown.')
  })
})

describe('panel: page messages', () => {
  it('unknownData: suggests the closest section key; empty section replaced by the onEmpty block', async () => {
    const page = ui.page({
      sections: [
        section('news', node('grid', { children: [node('card')] })),
        section('promo', node('grid', { children: [node('card')] }), { onEmpty: node('card', { props: { title: 'No promotions' } }) }),
      ],
      data: () => ({ newz: { card: [{ title: 'A' }] }, promo: { card: [] } }),
    })
    const result = await page.build(undefined, { trace: true })
    document.body.innerHTML = renderToStaticMarkup(createElement(DevtoolsData, { payload: inspect(result, ui.resolve(result, { trace: true })) }))
    dispose = mountDevtools({ open: true })
    button('sections').click()

    expect(text()).toContain('! newz unknownData — data returned for a section that is not on this page')
    expect(text()).toContain('Did you mean: news?')
    expect(text()).toContain('! promo empty — no node got data; replaced by the onEmpty block')
  })
})

describe('panel: coverage of other problems', () => {
  const mount = async (html: string) => {
    document.body.innerHTML = html
    dispose = mountDevtools({ open: true })
    button('sections').click()
  }
  const payloadHtml = async (page: ReturnType<typeof ui.page>, trace = true) => {
    const result = await page.build(undefined, { trace })
    const resolved = ui.resolve(result, { trace })
    return renderToStaticMarkup(
      createElement('main', null, createElement(Render<Contract>, { tree: resolved, registry, debug: true }), createElement(DevtoolsData, { payload: inspect(result, resolved) }))
    )
  }

  it('patch / remove selectors that match no node — with a corrected selector', async () => {
    const page = ui.page({ sections: [section('news', node('grid', { children: [node('card')] }), { patch: { crad: { title: 'x' } }, remove: 'zzz' })] })
    await mount(await payloadHtml(page))

    expect(text()).toContain('! 2 patch / remove selectors match no node — no effect; details in the sections below')
    expect(text()).toContain('! patch “crad” matches no node in this section — it has no effect. Did you mean: card?')
    expect(text()).toContain('! remove “zzz” matches no node in this section — nothing is removed.')

    link('card').click()
    await tick()
    expect((shadow().querySelector('input') as HTMLInputElement).value).toBe('card')
  })

  it('section data undefined (loader without return) — the section shows its layout only', async () => {
    const page = ui.page({ sections: [section('news', node('grid', { children: [node('card')] }), { data: async () => undefined as never })] })
    await mount(await payloadHtml(page))

    expect(text()).toContain('! news no data — the section loader returned undefined for this section, so it shows its layout only')
  })

  it('cache option with an undefined key; built without trace', async () => {
    const cached = ui.page({ cache: { key: () => undefined }, sections: [section('news', node('card'))] })
    await mount(await payloadHtml(cached))
    expect(text()).toContain('cache key: none — cache.key returned undefined for this ctx, so the page is not cached')

    dispose!()
    dispose = undefined
    await mount(await payloadHtml(ui.page({ sections: [section('news', node('card'))] }), false))
    expect(text()).toContain('built without trace — data item counts, prop origins')
  })

  it('component missing from the registry — marked by <Render debug>, reported in sections, tree and node', async () => {
    const page = ui.page({ sections: [section('news', node('grid', { children: [node('card')] }))], data: () => ({ news: { card: [{ title: 'A' }] } }) })
    const result = await page.build(undefined, { trace: true })
    const resolved = ui.resolve(result, { trace: true })
    await mount(
      renderToStaticMarkup(
        createElement(
          'main',
          null,
          createElement(Render<Contract>, { tree: resolved, registry: { grid: registry.grid }, debug: true }),
          createElement(DevtoolsData, { payload: inspect(result, resolved) })
        )
      )
    )

    expect(text()).toContain('✗ card is not in the registry — 1 node rendered by the fallback (or nothing): news.0; add “card” to the registry')

    button('tree').click()
    expect(row('card news.0').textContent).toContain('!')
    row('card news.0').click()
    expect(text()).toContain('“card” is not in the registry')
  })

  it('no payload on the page — hint how to add it', async () => {
    await mount('<main></main>')

    expect(text()).toContain('No devtools payload on this page')
    button('tree').click()
    expect(text()).toContain('No devtools payload on this page')
  })
})

describe('panel: timing', () => {
  const build = async (withContext: boolean, trace = true) => {
    const timed = createDedal<Contract>(withContext ? { AsyncLocalStorage: AsyncLocalStorage as never } : {})
    const articles = timed.query({ key: () => ['articles'], fn: async () => [{ title: 'A' }] })
    const page = timed.page({
      sections: [
        timed.section('news', timed.node('grid', { children: [timed.node('card')] })),
        timed.section('ads', timed.node('card'), {
          optional: true,
          data: async () => {
            throw new Error('503')
          },
        }),
      ],
      data: async () => ({ news: { card: await articles() } }),
    })
    const result = await page.build(undefined, { trace })
    const resolved = timed.resolve(result, { trace })
    document.body.innerHTML = renderToStaticMarkup(createElement(DevtoolsData, { payload: inspect(result, resolved) }))
    dispose = mountDevtools({ open: true })
    button('timing').click()
  }

  it('page build: stages, loaders as a waterfall, queries under their loader with cache status', async () => {
    await build(true)

    expect(text()).toMatch(/page build — [\d.]+ ms/)
    expect(text()).toMatch(/layout [\d.]+ ms\s+data loading [\d.]+ ms\s+assign [\d.]+ ms/)
    expect(text()).toContain('data loading — 2 loaders')
    expect(text()).toContain('They run in parallel; data loading takes as long as the slowest one.')
    expect(text()).toContain('failed — the loader threw')
    expect(shadow().querySelectorAll('.stages > .stage')).toHaveLength(3)
    expect(text()).toContain('queries — 1 miss')
    expect(text()).toContain('page data')
    expect(text()).toMatch(/query \["articles"\] miss [\d.]+ ms — fetched — not in the cache or expired/)
    expect(shadow().querySelectorAll('.track')).toHaveLength(2)
    expect(shadow().querySelector('.track > span.failed')).not.toBeNull()
  })

  it('without AsyncLocalStorage: loaders only, with a hint how to get query calls', async () => {
    await build(false)

    expect(text()).toContain('page data')
    expect(text()).toContain('query calls need AsyncLocalStorage')
  })

  it('built without trace: no timings, a hint', async () => {
    await build(true, false)

    expect(text()).toContain('No timings — the page was built without trace')
  })
})

describe('panel: copy report, remembered state, shortcut, side', () => {
  const shortcut = () => document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyS', key: 'S' }))

  it('copy report: a text report with the page URL goes to the clipboard; the button confirms', async () => {
    await renderPage()
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    dispose = mountDevtools({ open: true })

    button('copy report').click()
    await tick()

    expect(writeText).toHaveBeenCalledTimes(1)
    const [report] = writeText.mock.calls[0] as unknown as [string]
    expect(report.split('\n')[0]).toBe(`dedal devtools report — ${location.href}`)
    expect(report).toContain('page\n')
    expect(button('copied ✓')).toBeDefined()
    vi.unstubAllGlobals()
  })

  it('open state, tab and side survive a remount (reload) within the browser tab', async () => {
    await renderPage()
    dispose = mountDevtools()
    shortcut()
    button('timing').click()
    button('⇤').click()
    dispose()

    dispose = mountDevtools()
    expect((shadow().querySelector('.panel') as HTMLElement).hidden).toBe(false)
    expect(shadow().querySelector('.head button.active')!.textContent).toBe('timing')
    expect(shadow().querySelector('.root')!.classList.contains('left')).toBe(true)
    expect(button('⇥')).toBeDefined()
  })

  it('Alt+Shift+S toggles the panel; the open option wins over the remembered state', async () => {
    await renderPage()
    dispose = mountDevtools()
    const panel = () => shadow().querySelector('.panel') as HTMLElement

    expect(panel().hidden).toBe(true)
    shortcut()
    expect(panel().hidden).toBe(false)
    shortcut()
    expect(panel().hidden).toBe(true)

    dispose()
    dispose = mountDevtools({ open: true })
    expect(panel().hidden).toBe(false)
  })
})

describe('panel: data search in the tree', () => {
  it('a node found by its data shows the matching field; data not on the page is listed', async () => {
    const page = ui.page({
      sections: [section('news', node('grid', { children: [node('card')] }))],
      data: () => ({ news: { card: [{ title: 'Short title' }, { title: 'Lost' }] } }),
    })
    const result = await page.build(undefined, { trace: true })
    const resolved = ui.resolve(result, { trace: true })
    document.body.innerHTML = renderToStaticMarkup(
      createElement('main', null, createElement(Render<Contract>, { tree: resolved, registry, debug: true }), createElement(DevtoolsData, { payload: inspect(result, resolved) }))
    )
    dispose = mountDevtools({ open: true })
    button('tree').click()
    const input = shadow().querySelector('input')!

    input.value = 'short'
    input.dispatchEvent(new Event('input'))
    expect(text()).toContain('1 node with “short” in their data — highlighted on the page')
    expect(shadow().querySelector('.row.match')!.textContent).toContain('title: “Short title”')

    input.value = 'lost'
    input.dispatchEvent(new Event('input'))
    expect(text()).toContain('Found only in data that is not on the page (1).')
    expect(text()).toContain('! not on the page: section news · card [1] {"title":"Lost"}')
  })
})
