import type { PropSource } from '../types'
import type { BindingReport } from '../assign'
import {
  bindingMessages,
  droppedMessages,
  layoutSelectorMessages,
  NO_QUERY_TIMINGS,
  QUERY_STATUS,
  queryLabel,
  querySummary,
  reportText,
  searchNodes,
  searchSummary,
  mergePayloads,
  nodeIssueMessages,
  pageMessages,
  selectNodes,
  type DataMatch,
  type DevtoolsMessage,
  type BuildTiming,
  type QueryTiming,
  type DevtoolsPayload,
  type InspectedNode,
  type UnmatchedBinding,
} from './index'

/**
 * In-browser devtools panel: plain DOM in Shadow DOM (styles isolated both ways), one for React and Astro.
 *
 * Reads payloads from `<script type="application/json" data-dedal-devtools>` (also those streamed in later — `MutationObserver`)
 * and `<dedal-node data-dedal-key>` markers from `<Render debug>`. Content built exclusively via `textContent` —
 * the payload contains page data, so no `innerHTML` from data.
 */

export type MountOptions = {
  /** Panel open right away. By default: as left in this browser tab (closed the first time). */
  open?: boolean
}

/** Panel state kept per browser tab (`sessionStorage`) — survives reloads and navigation. */
type PanelState = { open: boolean; tab: Tab; side: 'right' | 'left' }

const STATE_KEY = 'dedal-devtools'

const loadState = (): Partial<PanelState> => {
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) ?? '{}') as Partial<PanelState>
  } catch {
    return {}
  }
}

const saveState = (state: PanelState) => {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (privacy mode) — the panel just does not remember its state
  }
}

/** Alt+Shift+S toggles the panel (by key code — on macOS Alt changes the typed character). */
const isShortcut = (event: KeyboardEvent) => event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyS'

type Tab = 'node' | 'tree' | 'sections' | 'timing'

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
/* the logo's palette at night: navy blueprint paper, blue lines, an orange core */
.root { font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #e6edf9; }
.toggle { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: grid; place-items: center; width: 36px; height: 36px;
  padding: 0; background: #1f2f4d; border: 1px solid #4998f399; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 16px #0b122040; }
.toggle:hover { border-color: #4998f3; }
.toggle svg { width: 22px; height: 22px; }
.panel { position: fixed; right: 16px; bottom: 60px; width: min(560px, calc(100vw - 32px)); max-height: 70vh; display: flex; flex-direction: column;
  z-index: 2147483647; background-color: #0f1a30; border: 1px solid #2f6bff66; border-radius: 8px; box-shadow: 0 8px 32px #0a1120a0;
  background-image: linear-gradient(#4998f30b 1px, transparent 1px), linear-gradient(90deg, #4998f30b 1px, transparent 1px); background-size: 16px 16px; }
.panel[hidden] { display: none; }
.root.left .toggle { right: auto; left: 16px; }
.root.left .panel { right: auto; left: 16px; }
.head { display: flex; gap: 4px; align-items: center; padding: 6px; border-bottom: 1px solid #22355a; flex-wrap: nowrap; background: #0c1527; border-radius: 8px 8px 0 0; }
.head button { flex: none; white-space: nowrap; }
/* buttons whose label changes keep their width — the header does not jump */
.head button.fixed { min-width: 7ch; text-align: center; }
.head button.report { min-width: 15ch; }
.head button { background: #16233f; color: #a7b4cc; border: 1px solid #22355a; border-radius: 4px; padding: 2px 8px; cursor: pointer; font: inherit; }
.head button:hover { color: #e6edf9; border-color: #4998f3; }
.head button.active { background: #4998f3; border-color: #4998f3; color: #0a1120; }
.head .spacer { flex: 1; }
.body { overflow: auto; padding: 10px 12px; line-height: 1.5; }
.muted { color: #7e8db0; }
.comp { color: #fff; font-weight: bold; }
.alias { color: #f0a65a; }
.sel { color: #7fb4ff; }
.data { color: #7ee2a8; }
.patch { color: #f0a65a; }
.err { color: #ff7a7a; }
.link { color: #7fb4ff; cursor: pointer; text-decoration: underline; }
.row { padding: 1px 0; cursor: pointer; white-space: nowrap; }
.row:hover { background: #16233f; }
.row.active { background: #1f3563; }
.row.match { background: #12301f; }
.row.match .comp { color: #7ee2a8; }
.row.dim { opacity: .45; }
.row .hit { color: #f0a65a; }
.filter { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0 8px; }
.filter label { color: #a7b4cc; cursor: pointer; white-space: nowrap; }
.filter .info { flex: 1; overflow-wrap: anywhere; }
.filter input[type='checkbox'] { width: auto; margin: 0 2px 0 0; vertical-align: middle; }
.prop { padding-left: 12px; overflow-wrap: anywhere; }
.block { margin: 8px 0; }
.title { margin: 10px 0 4px; color: #8b9bbd; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; }
.msgs { display: flex; flex-direction: column; gap: 6px; }
.msg { display: flex; gap: 6px; padding: 5px 8px; border-left: 3px solid #4998f3; border-radius: 3px; background: #132039; overflow-wrap: anywhere; }
.msg.err { border-color: #ff7a7a; background: #2e1620; }
.msg.patch { border-color: #e28025; background: #2e2213; }
.msg .icon { flex: none; }
.section { margin-top: 16px; padding-top: 10px; border-top: 1px solid #1d2b47; }
.section > .title { margin-top: 0; color: #d6dff0; font-size: 11px; }
.source { color: #7e8db0; margin-bottom: 4px; }
.binding { margin-top: 8px; }
.binding > .row { white-space: normal; }
.note { padding: 2px 0 0 18px; overflow-wrap: anywhere; }
.item { padding-left: 18px; color: #7e8db0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree-section { margin-top: 14px; padding-top: 8px; border-top: 1px solid #1d2b47; }
.tree-section:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.tree-section > .title { margin-top: 0; color: #d6dff0; font-size: 11px; }
.stages { display: flex; height: 10px; margin: 4px 0 2px; border-radius: 2px; overflow: hidden; background: #16233f; }
.stage { min-width: 2px; }
.layout { background: #b48cff; }
.load { background: #4998f3; }
.assign { background: #7ee2a8; }
.legend { color: #a7b4cc; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; vertical-align: middle; }
.subtitle { margin: 12px 0 2px; color: #c9d3e6; }
.axis { margin-top: 2px; }
.axis-labels { display: flex; justify-content: space-between; color: #6c7b98; font-size: 10px; }
.timing-row { display: grid; grid-template-columns: 110px 1fr 64px; gap: 8px; align-items: center; margin-top: 6px; }
.timing-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timing-row .ms { text-align: right; color: #c9d3e6; }
.track { position: relative; height: 8px; background: #16233f; border-radius: 2px; }
.track > span { position: absolute; top: 0; bottom: 0; min-width: 2px; border-radius: 2px; background: #4998f3; }
.track > span.failed { background: #ff7a7a; }
.query { padding-left: 18px; color: #a7b4cc; overflow-wrap: anywhere; }
.query .status-hit { color: #7ee2a8; }
.query .status-stale { color: #f0a65a; }
.query .status-miss { color: #7fb4ff; }
.query .status-bypass { color: #6c7b98; }
.query .status-error { color: #ff7a7a; }
input:focus { outline: none; border-color: #4998f3; }
input { width: 100%; background: #0a1120; color: #fff; border: 1px solid #2a3b5e; border-radius: 4px; padding: 4px 6px; font: inherit; }
.copy { margin-left: 6px; background: #16233f; color: #7fb4ff; border: 1px solid #22355a; border-radius: 4px; cursor: pointer; font: inherit; padding: 0 6px; }
.box { position: fixed; pointer-events: none; z-index: 2147483646; border: 2px solid #4998f3; background: #4998f322; }
.box.multi { border-color: #e28025; background: #e2802522; }
.label { position: fixed; pointer-events: none; z-index: 2147483647; background: #4998f3; color: #0a1120; padding: 1px 6px; border-radius: 3px; }
`

/** DOM element without `innerHTML`: attributes, events, children as text or nodes. */
function h(tag: string, attrs: Record<string, unknown> = {}, ...children: (Node | string | null | false | undefined)[]) {
  const element = document.createElement(tag)

  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (name.startsWith('on') && typeof value === 'function') element.addEventListener(name.slice(2), value as EventListener)
    else if (name === 'class') element.className = String(value)
    else element.setAttribute(name, value === true ? '' : String(value))
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child)

  return element
}


/** The Dedal mark: a labyrinth "D" with the core in the middle. */
const LOGO =
  '<svg viewBox="52 52 316 316" fill="none" aria-hidden="true"><path d="M75 210V75H260L345 160V260L260 345H75V270" stroke-width="30" stroke="#4998F3"/>' +
  '<path d="M285 235L235 285H135V135H235L260 160" stroke-width="30" stroke="#4998F3"/><rect x="180" y="180" width="60" height="60" fill="#E28025"/></svg>'

const logo = () => {
  const template = document.createElement('template')
  template.innerHTML = LOGO
  return template.content.firstChild as Node
}

const short = (value: unknown) => {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

const sourceLabel = (source?: PropSource) => {
  if (!source) return null
  if (source.from === 'patch') return h('span', { class: 'patch' }, ` ← patch ${source.selector}`)
  if (source.from === 'data') return h('span', { class: 'data' }, ' ← data')
  return h('span', { class: 'muted' }, ` ← ${source.from}`)
}

/** Node outline: an element with `display: contents` has no box, so we compute it from a range spanning its children. */
const rectOf = (element: Element) => {
  const range = document.createRange()
  range.selectNodeContents(element)
  return range.getBoundingClientRect()
}

const markerFor = (id: string) => document.querySelector(`dedal-node[data-dedal-key="${CSS.escape(id)}"]`)

/** Nodes whose component is missing from the registry — marked by `<Render debug>`: node ID → component. */
const missingComponents = () =>
  new Map([...document.querySelectorAll('dedal-node[data-dedal-missing]')].map(marker => [marker.getAttribute('data-dedal-key')!, marker.getAttribute('data-dedal-missing')!]))

const countOf = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const NO_PAYLOAD =
  'No devtools payload on this page — in debug mode render <DevtoolsData payload={inspect(result, resolved)} /> (or a <script type="application/json" data-dedal-devtools> with the payload).'

let mounted: (() => void) | undefined

/**
 * Mounts the devtools panel on the page. Call only in debug mode (the app's decision).
 * Returns an unmount function; calling again while the panel is mounted returns the same function.
 */
export function mountDevtools(options: MountOptions = {}): () => void {
  if (mounted) return mounted

  const host = h('div', { id: 'dedal-devtools' })
  const shadow = host.attachShadow({ mode: 'open' })
  const root = h('div', { class: 'root' })
  const boxes = h('div')
  const body = h('div', { class: 'body' })
  const head = h('div', { class: 'head' })
  const stored = loadState()
  let side: PanelState['side'] = stored.side === 'left' ? 'left' : 'right'
  const panel = h('div', { class: 'panel', hidden: !(options.open ?? stored.open ?? false) }, head, body)
  const toggle = h(
    'button',
    {
      class: 'toggle',
      title: 'dedal devtools (Alt+Shift+S)',
      'aria-label': 'dedal devtools',
      onclick: () => ((panel.hidden = !panel.hidden), persist(), render()),
    },
    logo()
  )
  shadow.append(h('style', {}, STYLE), root)
  root.classList.toggle('left', side === 'left')
  root.append(boxes, panel, toggle)
  document.body.append(host)

  let payload: DevtoolsPayload = mergePayloads([])
  // 'selector' — the former tab, now part of the tree
  const storedTab = (stored.tab as string) === 'selector' ? 'tree' : stored.tab
  let tab: Tab = storedTab && ['node', 'tree', 'sections', 'timing'].includes(storedTab) ? storedTab : 'node'
  let copied = false
  const persist = () => saveState({ open: !panel.hidden, tab, side })
  let selected: string | undefined
  let picking = false
  let query = ''
  let highlighted: string[] = []
  let focusSelector = false
  let onlyMatches = false

  // --- payloads from the page

  const scan = () => {
    const payloads = [...document.querySelectorAll('script[data-dedal-devtools]')].flatMap(script => {
      try {
        return [JSON.parse(script.textContent ?? '') as DevtoolsPayload]
      } catch {
        return []
      }
    })
    payload = mergePayloads(payloads)
    render()
  }

  // --- highlighting

  const highlight = (ids: string[]) => {
    highlighted = ids
    boxes.replaceChildren()
    for (const id of ids) {
      const marker = markerFor(id)
      if (!marker) continue
      const rect = rectOf(marker)
      if (!rect.width && !rect.height) continue
      boxes.append(
        h('div', {
          class: ids.length > 1 ? 'box multi' : 'box',
          style: `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`,
        })
      )
      if (ids.length === 1) {
        const node = payload.nodes[id]
        boxes.append(
          h('div', { class: 'label', style: `left:${rect.left}px;top:${Math.max(0, rect.top - 18)}px` }, node ? `${node.component} ${id}` : id)
        )
      }
    }
  }
  const refresh = () => highlight(highlighted)

  // --- picking an element on the page

  const ownEvent = (event: Event) => event.composedPath().includes(host)
  const markerFrom = (event: Event) => (event.target instanceof Element ? event.target.closest('dedal-node[data-dedal-key]') : null)

  const onMove = (event: MouseEvent) => {
    if (!picking || ownEvent(event)) return
    const marker = markerFrom(event)
    highlight(marker ? [marker.getAttribute('data-dedal-key')!] : [])
  }
  const onClick = (event: MouseEvent) => {
    if (!picking || ownEvent(event)) return
    const marker = markerFrom(event)
    event.preventDefault()
    event.stopPropagation()
    picking = false
    if (marker) select(marker.getAttribute('data-dedal-key')!)
    else render()
  }
  const onKey = (event: KeyboardEvent) => {
    if (isShortcut(event)) {
      event.preventDefault()
      panel.hidden = !panel.hidden
      persist()
      render()
      return
    }
    if (event.key === 'Escape' && picking) {
      picking = false
      highlight(selected ? [selected] : [])
      render()
    }
  }

  const select = (id: string) => {
    selected = id
    tab = 'node'
    panel.hidden = false
    highlight([id])
    render()
  }

  // --- views

  const nodeLink = (id: string) => {
    const node = payload.nodes[id]
    return h('span', { class: 'link', onclick: () => select(id), onmouseenter: () => highlight([id]) }, node ? `${node.component} ${id}` : id)
  }

  const copyButton = (text: string) =>
    h('button', { class: 'copy', title: 'copy', onclick: () => void navigator.clipboard?.writeText(text) }, 'copy')

  const nodeView = (): Node => {
    const node = selected ? payload.nodes[selected] : undefined
    if (!node) {
      return h('div', { class: 'muted' }, payload.sections.length ? 'Click “pick” and point at an element on the page, or select a node in the tree.' : NO_PAYLOAD)
    }
    const notInRegistry = missingComponents().has(node.id)

    return h(
      'div',
      {},
      h('div', {}, h('span', { class: 'comp' }, node.component), node.alias && h('span', { class: 'alias' }, ` #${node.alias}`)),
      h('div', { class: 'muted' }, `${node.id} · section ${node.section}${node.slot ? ` · slot ${node.slot}` : ''}`),
      h('div', { class: 'title' }, 'selector'),
      h('div', {}, h('span', { class: 'sel' }, node.selector), copyButton(node.selector), !node.unique && h('span', { class: 'err' }, ' (not unique)')),
      node.data &&
        h(
          'div',
          {},
          h('div', { class: 'title' }, 'data'),
          h('div', { class: 'data' }, node.data.selector ? `assigned by ${node.data.selector}` : 'assigned'),
          h('div', { class: 'prop' }, short(node.data.value))
        ),
      (node.issues.length > 0 || notInRegistry) &&
        h(
          'div',
          {},
          h('div', { class: 'title' }, 'issues'),
          notInRegistry && h('div', { class: 'err' }, `“${node.component}” is not in the registry — rendered by the fallback (or nothing); add it to the registry`),
          ...node.issues.map(issue => h('div', { class: 'err' }, issue))
        ),
      h('div', { class: 'title' }, 'props'),
      ...Object.entries(node.props).map(([name, prop]) =>
        h('div', { class: 'prop' }, h('span', { class: 'muted' }, `${name}: `), short(prop.value), sourceLabel(prop.source))
      ),
      node.parent && h('div', {}, h('div', { class: 'title' }, 'parent'), nodeLink(node.parent)),
      node.children.length > 0 &&
        h('div', {}, h('div', { class: 'title' }, 'children'), ...node.children.map(id => h('div', {}, nodeLink(id))))
    )
  }

  /** Tree rows of all sections; with `matched` — matches highlighted, others dimmed or (only matches) hidden. */
  const treeGroups = (matched: Set<string> | undefined, dataMatches: Map<string, DataMatch> = new Map()): Node[] => {
    const missing = missingComponents()
    // with "only matches": matches and their ancestors (context)
    let visible: Set<string> | undefined
    if (matched && onlyMatches) {
      visible = new Set()
      for (const id of matched) for (let at: string | undefined = id; at && !visible.has(at); at = payload.nodes[at]?.parent) visible.add(at)
    }

    return payload.sections.flatMap(section => {
      const rows: Node[] = []
      const visit = (node: InspectedNode | undefined, depth: number) => {
        if (!node || (visible && !visible.has(node.id))) return
        const state = matched ? (matched.has(node.id) ? ' match' : ' dim') : ''
        rows.push(
          h(
            'div',
            {
              class: `${node.id === selected ? 'row active' : 'row'}${state}`,
              style: `padding-left:${depth * 12}px`,
              onclick: () => select(node.id),
              onmouseenter: () => highlight([node.id]),
            },
            h('span', { class: 'comp' }, node.component),
            node.alias && h('span', { class: 'alias' }, ` #${node.alias}`),
            node.slot && h('span', { class: 'muted' }, ` :slot(${node.slot})`),
            h('span', { class: 'muted' }, ` ${node.id}`),
            node.data && h('span', { class: 'data' }, ' ●'),
            (node.issues.length > 0 || missing.has(node.id)) && h('span', { class: 'err' }, ' !'),
            dataMatches.has(node.id) && h('span', { class: 'hit' }, `  ${dataMatches.get(node.id)!.path}: “${dataMatches.get(node.id)!.value}”`)
          )
        )
        for (const child of node.children) visit(payload.nodes[child], depth + 1)
      }
      visit(payload.nodes[section.root], 0)
      if (visible && !rows.length) return []
      return [
        h(
          'div',
          { class: 'tree-section' },
          h('div', { class: 'title' }, `section ${section.key}${section.deferred ? ' (deferred)' : ''}${section.removed ? ' (removed — no data; layout before assign)' : ''}`),
          ...rows
        ),
      ]
    })
  }

  /** Tree with a selector filter: the same matcher as patch / assign, within each section; matches highlighted on the page. */
  const treeView = (): Node => {
    if (!payload.sections.length) return h('div', { class: 'muted' }, NO_PAYLOAD)

    const input = h('input', { placeholder: 'selector, ID, section or data — e.g. card:first-child, news, news.0.1, a headline', value: query }) as HTMLInputElement
    const only = h('input', { type: 'checkbox', ...(onlyMatches && { checked: true }) }) as HTMLInputElement
    const info = h('div', { class: 'muted info' })
    const list = h('div')

    const run = (fromInput: boolean) => {
      query = input.value
      info.replaceChildren()
      let matched: Set<string> | undefined
      let dataMatches = new Map<string, DataMatch>()
      if (query.trim()) {
        const search = searchNodes(payload, query)
        const ids = [...search.bySelector, ...search.byText, ...search.byData.map(({ id }) => id)]
        const summary = searchSummary(search, query)
        matched = new Set(ids)
        dataMatches = new Map(search.byData.map(match => [match.id, match]))
        highlight(ids)
        info.append(ids.length ? summary.text : h('span', { class: 'patch' }, summary.text))
        // a syntax error matters only when the text search found nothing either
        if (summary.error) info.append(h('div', { class: 'err' }, summary.error))
        for (const item of search.lost) {
          info.append(h('div', { class: 'patch' }, `! not on the page: section ${item.section} · ${item.selector} [${item.index}] ${item.preview}`))
        }
      } else if (fromInput) {
        highlight([])
      }
      list.replaceChildren(...treeGroups(matched, dataMatches))
    }

    input.addEventListener('input', () => run(true))
    only.addEventListener('change', () => ((onlyMatches = only.checked), run(false)))
    queueMicrotask(() => {
      // focus only when opened with a selector (e.g. from sections) — re-renders must not steal focus
      if (focusSelector) input.focus()
      focusSelector = false
    })
    run(false)

    return h(
      'div',
      {},
      input,
      h('div', { class: 'filter' }, info, h('label', {}, only, ' only matches')),
      list
    )
  }

  const openSelector = (selector: string) => {
    tab = 'tree'
    focusSelector = true
    query = selector
    render()
  }

  const levelClass = { error: 'err', warning: 'patch', info: 'muted', ok: 'data' } as const
  const levelIcon = { error: '✗ ', warning: '! ', info: '· ', ok: '✓ ' } as const

  /** A binding of a section: counts (report fields), sentences explaining the problem, unused data. */
  const bindingView = (binding: BindingReport, problem: UnmatchedBinding | undefined): Node[] => {
    const { level, summary, notes, suggestions } = bindingMessages(binding, problem)
    const lines: Node[] = [
      h(
        'div',
        { class: level === 'error' ? 'row err' : 'row', onmouseenter: () => highlight(binding.nodes ?? []), onclick: () => openSelector(binding.selector) },
        h('span', { class: levelClass[level] }, levelIcon[level]),
        h('span', { class: 'sel' }, binding.selector),
        h('span', { class: 'muted' }, ` — ${summary}`)
      ),
      ...notes.map((note, i) =>
        h(
          'div',
          { class: `note ${levelClass[level]}` },
          note,
          // suggestions (corrected selectors) belong to the first note — clickable, open the selector tab
          ...(i === 0 && suggestions.length
            ? [' Did you mean: ', ...suggestions.flatMap((suggestion, j) => [j ? ', ' : '', h('span', { class: 'link', onclick: () => openSelector(suggestion) }, suggestion)]), '?']
            : [])
        )
      ),
    ]
    if (binding.unusedItems?.length) {
      lines.push(
        ...binding.unusedItems.map(item => h('div', { class: 'item', title: item.preview }, `  [${item.index}] ${item.preview}`))
      )
    }
    return [h('div', { class: 'binding' }, ...lines)]
  }

  /** A page-level message: icon, subject (section key / node ID), text, suggested section keys. */
  const messageView = (message: DevtoolsMessage): Node =>
    h(
      'div',
      { class: `msg ${levelClass[message.level]}` },
      h('span', { class: 'icon' }, levelIcon[message.level]),
      h(
        'div',
        {},
        message.subject && h('span', { class: 'sel' }, `${message.subject} `),
        message.text,
        message.suggestions?.length ? ` Did you mean: ${message.suggestions.join(', ')}?` : ''
      )
    )

  /** Components missing from the registry (from `<Render debug>` markers), grouped by component. */
  const registryMessages = (): DevtoolsMessage[] => {
    const byComponent = new Map<string, string[]>()
    for (const [id, component] of missingComponents()) byComponent.set(component, [...(byComponent.get(component) ?? []), id])
    return [...byComponent].map(([component, ids]) => ({
      level: 'error' as const,
      subject: component,
      text: `is not in the registry — ${countOf(ids.length, 'node')} rendered by the fallback (or nothing): ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''}; add “${component}” to the registry`,
    }))
  }

  const sectionsView = (): Node =>
    h(
      'div',
      {},
      ...(payload.sections.length ? [] : [h('div', { class: 'muted' }, NO_PAYLOAD)]),
      h('div', { class: 'msgs' }, ...registryMessages().map(messageView), ...pageMessages(payload).map(messageView)),
      ...payload.sections.map(section =>
        h(
          'div',
          { class: 'section' },
          h('div', { class: 'title' }, `section ${section.key}${section.removed ? ' (removed — no data; layout before assign)' : ''}`),
          h(
            'div',
            { class: 'source' },
            'source: ',
            h('span', { class: 'sel' }, section.source ?? '?'),
            section.deferred && h('span', { class: 'patch' }, ' · deferred (fallback)'),
            ' · ',
            nodeLink(section.root)
          ),
          ...(section.report?.bindings ?? []).flatMap(binding =>
            bindingView(binding, section.diagnosis?.unmatched.find(problem => problem.selector === binding.selector))
          ),
          ...layoutSelectorMessages(section.diagnosis).map(({ text, suggestions }) =>
            h(
              'div',
              { class: 'binding patch' },
              `! ${text}`,
              ...(suggestions.length
                ? [' Did you mean: ', ...suggestions.flatMap((suggestion, j) => [j ? ', ' : '', h('span', { class: 'link', onclick: () => openSelector(suggestion) }, suggestion)]), '?']
                : [])
            )
          ),
          ...droppedMessages(section.diagnosis).map(text => h('div', { class: 'binding patch' }, `! ${text}`)),
          ...nodeIssueMessages(payload, section.key).map(text => h('div', { class: 'binding err' }, `✗ ${text}`))
        )
      )
    )

  /**
   * One build (page or a streamed section), read top to bottom: what the total is made of (stacked bar), the loaders on
   * the build's time axis (they run in parallel — the build waits for the slowest), then the queries of each loader.
   */
  const buildTimingView = (timing: BuildTiming): Node => {
    const scale = Math.max(timing.total, 0.1)
    const percent = (value: number) => `${Math.min((value / scale) * 100, 100)}%`
    const loaders = [...timing.loaders].sort((a, b) => a.start - b.start)
    const slowest = loaders.reduce<(typeof loaders)[number] | undefined>((max, loader) => (!max || loader.duration > max.duration ? loader : max), undefined)
    const queries = timing.queries
    const summary = querySummary(timing)

    const queryView = (query: QueryTiming) =>
      h(
        'div',
        { class: 'query' },
        `query ${queryLabel(query.key)} `,
        h('span', { class: `status-${query.status}` }, query.status),
        ` ${query.duration} ms — ${QUERY_STATUS[query.status]}`
      )

    const stage = (name: string, value: number, cls: string) =>
      h('span', { class: `stage ${cls}`, style: `width:${percent(value)}`, title: `${name} ${value} ms` })

    return h(
      'div',
      { class: 'section' },
      h('div', { class: 'title' }, timing.scope === 'page' ? `page build — ${timing.total} ms` : `section ${timing.scope} (streamed separately) — ${timing.total} ms`),
      // what the total is made of
      h('div', { class: 'stages' }, stage('layout', timing.layout, 'layout'), stage('data loading', timing.load, 'load'), stage('assign', timing.assign, 'assign')),
      h(
        'div',
        { class: 'legend' },
        h('span', { class: 'dot layout' }),
        ` layout ${timing.layout} ms  `,
        h('span', { class: 'dot load' }),
        ` data loading ${timing.load} ms  `,
        h('span', { class: 'dot assign' }),
        ` assign ${timing.assign} ms`
      ),

      h('div', { class: 'subtitle' }, `data loading — ${loaders.length} loader${loaders.length === 1 ? '' : 's'}`),
      loaders.length > 1 && h('div', { class: 'source' }, 'They run in parallel; data loading takes as long as the slowest one.'),
      loaders.length > 0 &&
        h('div', { class: 'timing-row axis' }, h('span', {}), h('span', { class: 'axis-labels' }, h('span', {}, '0 ms'), h('span', {}, `${timing.total} ms`)), h('span', {})),
      ...loaders.flatMap(loader => [
        h(
          'div',
          { class: 'timing-row' },
          h('span', { class: loader.failed ? 'name err' : 'name', title: loader.loader === 'page' ? 'page data()' : `section ${loader.loader} loader` }, loader.loader === 'page' ? 'page data' : loader.loader),
          h('div', { class: 'track' }, h('span', { class: loader.failed ? 'failed' : '', style: `left:${percent(loader.start)};width:${percent(loader.duration)}` })),
          h('span', { class: 'ms' }, `${loader.duration} ms`)
        ),
        ...(loader.failed
          ? [h('div', { class: 'note err' }, 'failed — the loader threw (see the sections tab)')]
          : loader === slowest && loaders.length > 1
            ? [h('div', { class: 'note muted' }, 'slowest — data loading waits for it')]
            : []),
        ...(queries ?? []).filter(query => query.loader === loader.loader).map(queryView),
      ]),
      loaders.length === 0 && h('div', { class: 'source' }, 'No loaders — every section is static or takes data from page data.'),

      h('div', { class: 'subtitle' }, summary ? `queries — ${summary}` : 'queries'),
      !summary && h('div', { class: 'source' }, NO_QUERY_TIMINGS),
      ...(queries ?? []).filter(query => query.loader === undefined).map(queryView)
    )
  }

  const timingView = (): Node => {
    const timings = payload.page.timings ?? []
    if (!payload.sections.length) return h('div', { class: 'muted' }, NO_PAYLOAD)
    if (!timings.length) {
      return h('div', { class: 'muted' }, 'No timings — the page was built without trace; use build(ctx, { trace: true }).')
    }
    return h(
      'div',
      {},
      h('div', { class: 'muted' }, 'Server-side build time of this page. Debug builds bypass the page cache; the query cache still applies.'),
      ...timings.map(buildTimingView)
    )
  }

  const tabButton = (id: Tab, label: string) =>
    h('button', { class: tab === id ? 'active' : '', onclick: () => ((tab = id), render()) }, label)

  const copyReport = () => {
    const title = `dedal devtools report — ${location.href}`
    void navigator.clipboard?.writeText(reportText(payload, { title, extra: registryMessages() })).then(() => {
      copied = true
      render()
      setTimeout(() => ((copied = false), render()), 1500)
    })
  }

  const switchSide = () => {
    side = side === 'right' ? 'left' : 'right'
    root.classList.toggle('left', side === 'left')
    render()
  }

  function render() {
    persist()
    if (panel.hidden) return
    head.replaceChildren(
      tabButton('node', 'node'),
      tabButton('tree', 'tree'),
      tabButton('sections', 'sections'),
      tabButton('timing', 'timing'),
      h('span', { class: 'spacer' }),
      h(
        'button',
        {
          class: picking ? 'fixed active' : 'fixed',
          title: picking ? 'click an element on the page — Esc cancels' : 'pick an element on the page to inspect its node',
          onclick: () => ((picking = !picking), render()),
        },
        'pick'
      ),
      h('button', { class: 'fixed report', title: 'copy a text report of the page (messages, problems, timings)', onclick: copyReport }, copied ? 'copied ✓' : 'copy report'),
      h('button', { title: side === 'right' ? 'move the panel to the left' : 'move the panel to the right', onclick: switchSide }, side === 'right' ? '⇤' : '⇥')
    )
    body.replaceChildren(
      tab === 'node'
        ? nodeView()
        : tab === 'tree'
          ? treeView()
          : tab === 'sections'
            ? sectionsView()
            : timingView()
    )
  }

  // --- start and cleanup

  const observer = new MutationObserver(mutations => {
    const added = mutations.some(mutation =>
      [...mutation.addedNodes].some(
        added => added instanceof Element && (added.matches('script[data-dedal-devtools]') || added.querySelector('script[data-dedal-devtools]'))
      )
    )
    if (added) scan()
    if (highlighted.length) refresh()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', refresh, true)
  window.addEventListener('resize', refresh)

  scan()

  mounted = () => {
    observer.disconnect()
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('scroll', refresh, true)
    window.removeEventListener('resize', refresh)
    host.remove()
    mounted = undefined
  }

  return mounted
}
