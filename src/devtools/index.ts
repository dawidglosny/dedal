import type { AssignReport } from '../assign'
import type { LayoutSelectorReport, PageResult, SectionSource } from '../page'
import type { BuildTiming, QueryTiming } from '../timing'

export type { BuildTiming, QueryTiming }
import { select } from '../patch'
import { matches, parseSelector, type PathEntry } from '../selectors'
import type { ResolvedNode, ResolvedPage } from '../resolve'
import type { LayoutNode, PathSegment, PropSource } from '../types'

/** Devtools payload format version. */
export const DEVTOOLS_VERSION = 1

/** Node prop: value after `resolve` and its origin (when `build` / `resolve` ran with `trace`). */
export type InspectedProp = { value: unknown; source?: PropSource }

/** A node in the devtools payload: where it is, what it got — data, props and their origin — and the selector that finds it. */
export type InspectedNode = {
  id: string
  component: string
  alias?: string
  /** Section key. */
  section: string
  /** Parent ID; absent = section root. */
  parent?: string
  /** Name of the parent's slot the node sits in. */
  slot?: string
  /** Position from the section root. */
  path: PathSegment[]
  /** IDs of direct children in tree order (slots, then children). */
  children: string[]
  props: Record<string, InspectedProp>
  /** Data assigned to the node and the selector that assigned it (selector — from `build(ctx, { trace: true })`). */
  data?: { value: unknown; selector?: string }
  /** `resolve` issues concerning the node. */
  issues: string[]
  /**
   * Shortest selector hitting only this node within the section — for patches and bindings.
   * Computed on the tree after `assign`: when `assign` removed siblings, positions (`:nth-child`) in the template may differ.
   */
  selector: string
  /** `false` when even the full path matches several nodes (repeated structure). */
  unique: boolean
}

/** A section in the devtools payload: its root, data source, bindings and what went wrong in it. */
export type InspectedSection = {
  key: string
  /** Section root ID. */
  root: string
  /** Section data source — only from `build(ctx, { trace: true })`. */
  source?: SectionSource
  /** Fallback of a deferred section. */
  deferred?: true
  /** Section `assign()` report (when it received data). */
  report?: AssignReport
  /**
   * Section removed by data (`onShortage` removed the root, `onEmpty: 'remove'`) — nodes are the layout before assignment
   * (from `build(ctx, { trace: true })`), with no counterpart on the page.
   */
  removed?: true
  /** No node got data (`emptySections`): `'kept'` — the section stays (`onEmpty: 'keep'`), `'replaced'` — by the `onEmpty` block. */
  empty?: 'kept' | 'replaced'
  /** Data mismatches: bindings without hits, removed nodes, dropped data. */
  diagnosis?: SectionDiagnosis
}

/** Devtools payload — plain JSON, embedded in the page (`<script type="application/json" data-dedal-devtools>`). */
export type DevtoolsPayload = {
  devtools: typeof DEVTOOLS_VERSION
  sections: InspectedSection[]
  nodes: Record<string, InspectedNode>
  page: {
    unknownData: string[]
    removedSections: string[]
    failedSections: string[]
    /** Sections expecting data that did not receive it (`onEmpty`). */
    emptySections: string[]
    /** Page cache key — only from `build(ctx, { trace: true })`. */
    cacheKey?: string | null
    /** Error messages of failed optional sections — only from `build(ctx, { trace: true })`. */
    sectionErrors?: Record<string, string>
    /** The page has a `cache` option (with `cacheKey: null` its `key` returned `undefined`) — only with trace. */
    cacheOption?: true
    /** Keys of all sections of the page for this ctx — only from `build(ctx, { trace: true })`. */
    sectionKeys?: string[]
    /** Stage, loader and query timings — the page build and each streamed section (`page.section`); only with trace. */
    timings?: BuildTiming[]
    /** `resolve` issues not tied to a node (e.g. data without a node). */
    issues: { id: string; message: string }[]
  }
}

type Entry<C> = { node: LayoutNode<C>; index: number; count: number; slot?: string }

const childEntries = <C>(node: LayoutNode<C>): Entry<C>[] => {
  const entries: Entry<C>[] = []

  for (const [slot, content] of Object.entries(node.slots ?? {})) {
    const list = Array.isArray(content) ? content : [content]
    list.forEach((child, index) => entries.push({ node: child, index, count: list.length, slot }))
  }
  node.children?.forEach((child, index, all) => entries.push({ node: child, index, count: all.length }))

  return entries
}

const collectResolved = <C>(node: ResolvedNode<C>, into: Map<string, ResolvedNode<C>>) => {
  into.set(node.key, node)
  for (const content of Object.values(node.slots ?? {})) {
    for (const child of Array.isArray(content) ? content : [content]) collectResolved(child, into)
  }
  node.children?.forEach(child => collectResolved(child, into))
}

/**
 * Builds the devtools payload: an index of all page nodes with props (and their origin), data, issues
 * and a suggested selector. Pure function — runs in Node, on the edge and in the browser; the result is JSON.
 *
 * Prop origins and section sources are available when the page was built with `build(ctx, { trace: true })`
 * and the tree with `resolve(result, { trace: true })`.
 *
 * @example
 * ```ts
 * const result = await home.build(ctx, { trace: true })
 * const resolved = ui.resolve(result, { ctx, trace: true })
 * const payload = inspect(result, resolved)
 * ```
 */
export function inspect<C>(result: PageResult<C>, resolved: ResolvedPage<C>): DevtoolsPayload {
  const resolvedNodes = new Map<string, ResolvedNode<C>>()
  for (const { tree } of resolved.sections) collectResolved(tree, resolvedNodes)

  const issuesById = new Map<string, string[]>()
  const pageIssues: { id: string; message: string }[] = []
  for (const issue of resolved.issues) {
    if (resolvedNodes.has(issue.id)) issuesById.set(issue.id, [...(issuesById.get(issue.id) ?? []), issue.message])
    else pageIssues.push(issue)
  }

  const nodes: Record<string, InspectedNode> = {}
  const sections: InspectedSection[] = []

  const removedLayouts = result.report.trace?.removedLayouts ?? {}
  const present = new Set(result.sections.map(({ key }) => key))
  // sections removed by data (trace only) — in page order, with the layout before assignment
  const order = Object.keys(result.report.trace?.sources ?? {})
  const all = [
    ...result.sections.map(({ key, layout: root, deferred }) => ({ key, root, deferred, removed: false })),
    ...Object.entries(removedLayouts)
      .filter(([key]) => !present.has(key))
      .map(([key, root]) => ({ key, root, deferred: undefined, removed: true })),
  ].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))

  for (const { key, root, deferred, removed } of all) {
    const report = result.report.sections[key]
    const source = result.report.trace?.sources[key]
    const diagnosis = diagnose(removedLayouts[key] ?? root, report, result.report.trace?.layoutSelectors?.[key])
    sections.push({
      key,
      root: root.id,
      ...(source && { source }),
      ...(deferred && { deferred }),
      ...(report && { report }),
      ...(removed && { removed: true as const }),
      ...(!removed && result.report.emptySections.includes(key) && { empty: removedLayouts[key] ? ('replaced' as const) : ('kept' as const) }),
      ...(diagnosis && { diagnosis }),
    })

    const selectorOf = new Map<string, string>()
    for (const binding of report?.bindings ?? []) {
      for (const id of binding.nodes ?? []) if (!binding.missing.includes(id)) selectorOf.set(id, binding.selector)
    }

    const suggest = createSuggester(root)

    const visit = (entry: Entry<C>, path: PathSegment[], parent?: LayoutNode<C>) => {
      const { node } = entry
      const resolvedNode = resolvedNodes.get(node.id)
      const props = (resolvedNode?.props ?? node.props) as Record<string, unknown>
      const children = childEntries(node)
      const { selector, unique } = suggest(node.id)

      nodes[node.id] = {
        id: node.id,
        component: node.component,
        ...(node.alias !== undefined && { alias: node.alias }),
        section: key,
        ...(parent && { parent: parent.id }),
        ...(entry.slot !== undefined && { slot: entry.slot }),
        path,
        children: children.map(child => child.node.id),
        // `undefined` means no value (JSON format rule) — skipped so the payload round-trips through JSON unchanged
        props: Object.fromEntries(
          Object.entries(props)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => {
            const propSource = resolvedNode?.trace?.[name] ?? node.trace?.[name]
              return [name, { value, ...(propSource && { source: propSource }) }]
            })
        ),
        ...(Object.hasOwn(result.data, node.id) && {
          data: { value: result.data[node.id], ...(selectorOf.has(node.id) && { selector: selectorOf.get(node.id) }) },
        }),
        issues: issuesById.get(node.id) ?? [],
        selector,
        unique,
      }

      for (const child of children) {
        const segment: PathSegment =
          child.slot === undefined ? child.index : { slot: child.slot, ...(child.count > 1 && { index: child.index }) }
        visit(child, [...path, segment], node)
      }
    }

    visit({ node: root, index: 0, count: 1 }, [])
  }

  return {
    devtools: DEVTOOLS_VERSION,
    sections,
    nodes,
    page: {
      unknownData: result.report.unknownData,
      removedSections: result.report.removedSections,
      failedSections: result.report.failedSections,
      emptySections: result.report.emptySections ?? [],
      ...(result.report.trace && { cacheKey: result.report.trace.cacheKey, sectionKeys: Object.keys(result.report.trace.sources) }),
      ...(result.report.trace?.sectionErrors && { sectionErrors: result.report.trace.sectionErrors }),
      ...(result.report.trace?.cacheOption && { cacheOption: true as const }),
      ...(result.report.trace?.timing && { timings: [result.report.trace.timing] }),
      issues: pageIssues,
    },
  }
}

/**
 * Suggested selectors within a section. Candidates from shortest (`#alias`, `card`, `card:nth-child(2)`,
 * then a `parent > child` chain up the tree, anchored at the root via `:root`); each checked with the core
 * `select()` — the first one hitting exactly this one node wins.
 */
function createSuggester<C>(root: LayoutNode<C>) {
  const parents = new Map<string, { node: LayoutNode<C>; entry: Entry<C> }>()
  const entries = new Map<string, Entry<C>>([[root.id, { node: root, index: 0, count: 1 }]])
  const aliasCount = new Map<string, number>()

  const index = (node: LayoutNode<C>) => {
    if (node.alias !== undefined) aliasCount.set(node.alias, (aliasCount.get(node.alias) ?? 0) + 1)
    for (const entry of childEntries(node)) {
      parents.set(entry.node.id, { node, entry })
      entries.set(entry.node.id, entry)
      index(entry.node)
    }
  }
  index(root)

  const cache = new Map<string, LayoutNode<C>[]>()
  const matches = (selector: string) => {
    let found = cache.get(selector)
    if (!found) cache.set(selector, (found = select(root, selector)))
    return found
  }
  const hitsOnly = (selector: string, id: string) => {
    const found = matches(selector)
    return found.length === 1 && found[0].id === id
  }

  /** Node compound: component + slot + position (when it has siblings); root with `:root` so the chain is anchored. */
  const compound = (id: string) => {
    if (id === root.id) return `${root.component}:root`

    const { node, slot, index: position, count } = entries.get(id)!
    const slotPart = slot === undefined ? '' : `:slot(${slot})`
    const nthPart = count > 1 ? `:nth-child(${position + 1})` : ''
    return `${node.component}${slotPart}${nthPart}`
  }

  /** Shortest reference to an ancestor in the chain: a unique alias or the compound. */
  const ancestorRef = (node: LayoutNode<C>) =>
    node.alias !== undefined && aliasCount.get(node.alias) === 1 ? `#${node.alias}` : compound(node.id)

  return (id: string): { selector: string; unique: boolean } => {
    const { node } = entries.get(id)!
    const candidates = [
      ...(node.alias !== undefined && aliasCount.get(node.alias) === 1 ? [`#${node.alias}`] : []),
      node.component,
      compound(id),
    ]

    for (const candidate of candidates) if (hitsOnly(candidate, id)) return { selector: candidate, unique: true }

    let selector = compound(id)
    for (let parent = parents.get(id); parent; parent = parents.get(parent.node.id)) {
      selector = `${ancestorRef(parent.node)} > ${selector}`
      if (hitsOnly(selector, id)) return { selector, unique: true }
      if (parent.node.alias !== undefined && aliasCount.get(parent.node.alias) === 1) break
    }

    return { selector, unique: hitsOnly(selector, id) }
  }
}

/**
 * Merges payloads from multiple renders of a page (e.g. a deferred section streamed separately). A section from a later
 * payload replaces the section with the same key (the deferred section's content replaces its fallback).
 */
export function mergePayloads(payloads: DevtoolsPayload[]): DevtoolsPayload {
  const sections = new Map<string, InspectedSection>()
  const merged: DevtoolsPayload = {
    devtools: DEVTOOLS_VERSION,
    sections: [],
    nodes: {},
    page: { unknownData: [], removedSections: [], failedSections: [], emptySections: [], issues: [] },
  }
  const union = (into: string[], items: string[]) => items.forEach(item => !into.includes(item) && into.push(item))

  for (const payload of payloads) {
    for (const section of payload.sections) sections.set(section.key, section)
    Object.assign(merged.nodes, payload.nodes)
    union(merged.page.unknownData, payload.page.unknownData)
    union(merged.page.removedSections, payload.page.removedSections)
    union(merged.page.failedSections, payload.page.failedSections)
    union(merged.page.emptySections, payload.page.emptySections ?? [])
    for (const issue of payload.page.issues) {
      if (!merged.page.issues.some(known => known.id === issue.id && known.message === issue.message)) merged.page.issues.push(issue)
    }
    if (merged.page.cacheKey === undefined && payload.page.cacheKey !== undefined) merged.page.cacheKey = payload.page.cacheKey
    if (payload.page.cacheOption) merged.page.cacheOption = true
    // one timing per scope: a later payload (re-render) replaces the earlier one
    for (const timing of payload.page.timings ?? []) {
      merged.page.timings = [...(merged.page.timings ?? []).filter(known => known.scope !== timing.scope), timing]
    }
    if (payload.page.sectionErrors) merged.page.sectionErrors = { ...merged.page.sectionErrors, ...payload.page.sectionErrors }
    if (payload.page.sectionKeys) union((merged.page.sectionKeys ??= []), payload.page.sectionKeys)
  }

  merged.sections = [...sections.values()]
  return merged
}

/**
 * IDs of nodes matching the selector — the same matcher as `patch` / `assign`, on the payload tree, within each
 * section (like section patches). Attributes (`[size=lg]`) are compared against layout props (without props from data,
 * when the origin is known). Throws `SyntaxError` for invalid syntax.
 */
export function selectNodes(
  payload: DevtoolsPayload,
  selector: string,
  options: { section?: string; includeRemoved?: boolean } = {}
): string[] {
  const list = parseSelector(selector)
  const found: string[] = []

  const entryOf = (node: InspectedNode, index: number, count: number): PathEntry => ({
    node: {
      component: node.component,
      ...(node.alias !== undefined && { alias: node.alias }),
      props: Object.fromEntries(
        Object.entries(node.props)
          .filter(([, prop]) => prop.source?.from !== 'data')
          .map(([name, prop]) => [name, prop.value])
      ),
    },
    index,
    count,
    ...(node.slot !== undefined && { slot: node.slot }),
  })

  const visit = (path: PathEntry[], node: InspectedNode) => {
    if (matches(list, path)) found.push(node.id)

    const children = node.children.map(id => payload.nodes[id]).filter(Boolean)
    for (const child of children) {
      const group = children.filter(sibling => sibling.slot === child.slot)
      visit([...path, entryOf(child, group.indexOf(child), group.length)], child)
    }
  }

  for (const { key, root, removed } of payload.sections) {
    if (options.section !== undefined && key !== options.section) continue
    // sections removed by data are not on the page (their layout before assign is only for diagnosis)
    if (removed && !options.includeRemoved) continue
    const node = payload.nodes[root]
    if (node) visit([entryOf(node, 0, 1)], node)
  }

  return found
}

/** A binding that assigned data to no node even though it received data — all of its data is lost. */
export type UnmatchedBinding = {
  selector: string
  /** Number of data items that were lost. */
  lost: number
  /**
   * `'no-match'` — the selector hits no node in the section (typo, block change);
   * `'claimed'` — it hits, but all nodes were claimed by earlier bindings (order: specific before general).
   */
  reason: 'no-match' | 'claimed'
  /** `'no-match'`: similar selectors that hit nodes in the section. */
  suggestions: string[]
  /** `'claimed'`: bindings that claimed the hit nodes (from `trace`). */
  claimedBy: string[]
}

/** Section data diagnosis — only when there is something to show. */
export type SectionDiagnosis = {
  unmatched: UnmatchedBinding[]
  /** `remove` / `patch` selectors of the section that matched no node (no effect), with corrected selectors that hit. */
  layout: { kind: 'remove' | 'patch'; selector: string; suggestions: string[] }[]
  /** Nodes removed by `onShortage: 'remove'` and the binding that claimed them without data. */
  removed: { id: string; by?: string }[]
  /** Data dropped because the node disappeared together with a removed ancestor (`with`). */
  dropped: { id: string; with?: string }[]
}

/** Edit distance counting a transposition of adjacent characters as one change (`crad` → `card`: 1). */
const distance = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Component names and aliases in the selector (without pseudo-classes and attributes). */
const identifiers = (selector: string) =>
  selector
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/:[\w-]+(\([^)]*\))?/g, ' ')
    .match(/#?[A-Za-z_][\w-]*/g) ?? []

/** Replaces an identifier in the selector (the token is `#`, letters, digits, `-`, `_` — no regex special characters). */
const replaceIdentifier = (selector: string, token: string, by: string) =>
  selector.replace(new RegExp(`(^|[^\\w#-])${token}(?![\\w-])`, 'g'), `$1${by}`)

const isDescendant = (id: string, ancestor: string) => id.startsWith(`${ancestor}.`) || id.startsWith(`${ancestor}:`)

/**
 * Section data diagnosis on the layout before removals (`root`): bindings without hits with a reason and suggestions,
 * removed nodes with the binding that claimed them, dropped data with the removed ancestor.
 */
function diagnose<C>(
  root: LayoutNode<C>,
  report: AssignReport | undefined,
  layoutSelectors: LayoutSelectorReport[] = []
): SectionDiagnosis | undefined {
  const known = new Set<string>()
  const slotNames = new Set<string>()
  const index = (node: LayoutNode<C>) => {
    known.add(node.component)
    if (node.alias !== undefined) known.add(`#${node.alias}`)
    for (const entry of childEntries(node)) {
      if (entry.slot !== undefined) slotNames.add(entry.slot)
      index(entry.node)
    }
  }
  index(root)

  const hits = (selector: string) => {
    try {
      return select(root, selector).map(({ id }) => id)
    } catch {
      return []
    }
  }

  // each unknown identifier → closest known one (of the same kind: alias / component); suggestion only
  // when the corrected selector hits something
  const suggest = (selector: string) => {
    let fixed = selector
    for (const token of new Set(identifiers(selector))) {
      if (known.has(token)) continue
      const [closest] = [...known]
        .filter(candidate => candidate.startsWith('#') === token.startsWith('#'))
        .map(candidate => ({ candidate, score: distance(token, candidate) }))
        .filter(({ candidate, score }) => score <= Math.max(2, Math.floor(Math.max(token.length, candidate.length) / 3)))
        .sort((a, b) => a.score - b.score)
      if (closest) fixed = replaceIdentifier(fixed, token, closest.candidate)
    }
    // slot names (`:slot(badges)`) — compared with the slots that exist in this section
    fixed = fixed.replace(/:slot\(\s*([\w-]+)\s*\)/g, (whole, name: string) => {
      if (slotNames.has(name)) return whole
      const [closest] = [...slotNames]
        .map(candidate => ({ candidate, score: distance(name, candidate) }))
        .filter(({ candidate, score }) => score <= Math.max(2, Math.floor(Math.max(name.length, candidate.length) / 3)))
        .sort((a, b) => a.score - b.score)
      return closest ? `:slot(${closest.candidate})` : whole
    })
    return fixed !== selector && hits(fixed).length ? [fixed] : []
  }

  const layout = layoutSelectors
    .filter(({ matched }) => matched === 0)
    .map(({ kind, selector }) => ({ kind, selector, suggestions: suggest(selector) }))

  if (!report) return layout.length ? { unmatched: [], layout, removed: [], dropped: [] } : undefined

  const unmatched = report.bindings
    .filter(binding => binding.matched === 0 && binding.unused > 0)
    .map((binding): UnmatchedBinding => {
      const found = hits(binding.selector)

      if (found.length) {
        const claimedBy = report.bindings
          .filter(other => other !== binding && other.nodes?.some(id => found.includes(id)))
          .map(other => other.selector)
        return { selector: binding.selector, lost: binding.unused, reason: 'claimed', suggestions: [], claimedBy }
      }

      return { selector: binding.selector, lost: binding.unused, reason: 'no-match', suggestions: suggest(binding.selector), claimedBy: [] }
    })

  const removed = report.removed.map(id => {
    const by = report.bindings.find(binding => binding.missing.includes(id))?.selector
    return by === undefined ? { id } : { id, by }
  })
  const dropped = report.dropped.map(id => {
    const ancestor = report.removed.find(candidate => isDescendant(id, candidate))
    return ancestor === undefined ? { id } : { id, with: ancestor }
  })

  return unmatched.length || layout.length || removed.length || dropped.length ? { unmatched, layout, removed, dropped } : undefined
}

// ---------- messages (panel, DebugView in examples)

/** A devtools message: severity, subject (section key / node ID), text and optional suggestions. */
export type DevtoolsMessage = {
  level: 'error' | 'warning' | 'info'
  subject?: string
  text: string
  /** Section keys (`unknownData`) — rendered as “Did you mean: …?”. */
  suggestions?: string[]
}

const closest = (token: string, candidates: string[]) =>
  candidates
    .filter(candidate => candidate !== token)
    .map(candidate => ({ candidate, score: distance(token, candidate) }))
    .filter(({ candidate, score }) => score <= Math.max(2, Math.floor(Math.max(token.length, candidate.length) / 3)))
    .sort((a, b) => a.score - b.score)
    .map(({ candidate }) => candidate)

/** Page-level messages: cache, unmatched bindings, failed / removed / empty sections, unknown data, page issues. */
export function pageMessages(payload: DevtoolsPayload): DevtoolsMessage[] {
  const { page } = payload
  const messages: DevtoolsMessage[] = []
  const traced = page.sectionKeys !== undefined
  const sectionOf = (key: string) => payload.sections.find(section => section.key === key)

  if (payload.sections.length && !traced) {
    messages.push({
      level: 'info',
      text: 'built without trace — data item counts, prop origins, unmatched bindings and removed sections are not available; use build(ctx, { trace: true }) and resolve(result, { trace: true })',
    })
  }

  if (page.cacheKey !== undefined) {
    messages.push({
      level: 'info',
      text:
        page.cacheKey !== null
          ? `cache key: ${page.cacheKey} — debug builds bypass the cache`
          : page.cacheOption
            ? 'cache key: none — cache.key returned undefined for this ctx, so the page is not cached'
            : 'cache key: none — the page has no cache option',
    })
  }

  const unmatched = payload.sections.flatMap(section => section.diagnosis?.unmatched ?? [])
  if (unmatched.length) {
    const lost = unmatched.reduce((sum, binding) => sum + binding.lost, 0)
    messages.push({
      level: 'error',
      text: `${countOf(unmatched.length, 'binding')} match${unmatched.length === 1 ? 'es' : ''} no node — ${countOf(lost, 'data item')} not shown; details in the sections below`,
    })
  }

  const layoutSelectors = payload.sections.flatMap(section => section.diagnosis?.layout ?? [])
  if (layoutSelectors.length) {
    messages.push({
      level: 'warning',
      text: `${countOf(layoutSelectors.length, 'patch / remove selector')} match${layoutSelectors.length === 1 ? 'es' : ''} no node — no effect; details in the sections below`,
    })
  }

  for (const section of payload.sections) {
    // data source known (trace), but no assign report: the data for the section was undefined
    if ((section.source === 'page' || section.source === 'section') && !section.report && !section.deferred && !page.failedSections.includes(section.key)) {
      messages.push({
        level: 'warning',
        subject: section.key,
        text: `no data — ${section.source === 'section' ? 'the section loader' : 'page data'} returned undefined for this section, so it shows its layout only; return bindings (e.g. { card: [...] })`,
      })
    }
  }

  for (const key of page.failedSections) {
    const error = page.sectionErrors?.[key]
    messages.push({
      level: 'error',
      subject: key,
      text: error
        ? `failed — the loader threw "${error}"; the section is skipped (optional: true)`
        : 'failed — the loader threw; the section is skipped (optional: true); the error goes to onSectionError',
    })
  }

  for (const key of page.removedSections) {
    const section = sectionOf(key)
    const seeBelow = section?.diagnosis?.unmatched.length ? '; see the unmatched binding(s) below' : ''
    // some nodes got data, yet the section is empty: `required` nodes got none
    const partly = (section?.report?.bindings ?? []).some(binding => binding.assigned > 0)
    const text = page.emptySections.includes(key)
      ? partly
        ? `removed — none of the required nodes got data (required, onEmpty: 'remove')${seeBelow}`
        : `removed — no node got data (onEmpty: 'remove')${seeBelow}`
      : section?.removed
        ? `removed — its root node got no data (onShortage: 'remove')${seeBelow}`
        : traced
          ? "removed — the section's remove option removed its root"
          : "removed — by the section's remove option or because its root got no data"
    messages.push({ level: 'warning', subject: key, text })
  }

  for (const key of page.emptySections) {
    if (page.removedSections.includes(key)) continue
    const empty = sectionOf(key)?.empty
    const what = (sectionOf(key)?.report?.bindings ?? []).some(binding => binding.assigned > 0) ? 'none of the required nodes got data' : 'no node got data'
    messages.push({
      level: 'warning',
      subject: key,
      text:
        empty === 'replaced'
          ? `empty — ${what}; replaced by the onEmpty block`
          : empty === 'kept'
            ? `empty — ${what}; kept as is (onEmpty: 'keep')`
            : `empty — ${what}`,
    })
  }

  // resolve issues of nodes (data that is not an object, toProps errors) — details per section / node
  const withIssues = Object.values(payload.nodes).filter(node => node.issues.length)
  if (withIssues.length) {
    messages.push({
      level: 'error',
      text: `${countOf(withIssues.length, 'node')} ha${withIssues.length === 1 ? 's' : 've'} issues — rendered with layout props only; details in the sections below`,
    })
  }

  for (const key of page.unknownData) {
    const suggestions = closest(key, page.sectionKeys ?? [])
    messages.push({
      level: 'warning',
      subject: key,
      text: 'unknownData — data returned for a section that is not on this page (a typo in the key, or a section from another variant); the data is ignored',
      ...(suggestions.length && { suggestions: suggestions.slice(0, 3) }),
    })
  }

  for (const issue of page.issues) messages.push({ level: 'error', subject: issue.id, text: issue.message })

  return messages
}

/** `1 node`, `3 nodes`, `0 data items`. */
const countOf = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Messages for one binding of a section. `summary` — how many data items for how many nodes (`received` only
 * with trace; without it: how many nodes were filled); `notes` — what happened as a result and what to do;
 * `suggestions` — corrected selectors.
 */
export function bindingMessages(
  binding: AssignReport['bindings'][number],
  problem?: UnmatchedBinding
): { level: 'ok' | 'warning' | 'error'; summary: string; notes: string[]; suggestions: string[] } {
  // null items: received but not assigned and not surplus
  const nulls = binding.received !== undefined ? binding.received - binding.assigned - binding.unused : 0
  const summary =
    binding.received !== undefined
      ? `${countOf(binding.received, 'data item')} for ${countOf(binding.matched, 'node')}${nulls > 0 ? ` (${nulls} null)` : ''}`
      : `${binding.assigned} of ${countOf(binding.matched, 'node')} filled`
  const selector = `“${binding.selector}”`

  if (problem?.reason === 'no-match') {
    return {
      level: 'error',
      summary,
      notes: [
        `No node in this section matches ${selector} — the data is not shown.` +
          (problem.suggestions.length ? '' : ' Check component names and aliases in the tree.'),
      ],
      suggestions: problem.suggestions,
    }
  }
  if (problem?.reason === 'claimed') {
    const by = problem.claimedBy.map(other => `“${other}”`).join(', ') || 'an earlier binding'
    return {
      level: 'error',
      summary,
      notes: [`${selector} matches nodes already filled by ${by} — the data is not shown. Move ${selector} before ${by} in this section’s data.`],
      suggestions: [],
    }
  }

  const notes: string[] = []
  if (binding.missing.length) {
    const ids = binding.missing.slice(0, 5).join(', ') + (binding.missing.length > 5 ? ', …' : '')
    const count = countOf(binding.missing.length, 'node')
    notes.push(
      binding.onShortage === 'remove'
        ? `${count} removed — nothing to fill ${binding.missing.length === 1 ? 'it' : 'them'} with (onShortage: 'remove'): ${ids}`
        : `${count} left empty (onShortage: 'keep'): ${ids}`
    )
  }
  if (binding.unused) {
    notes.push(`${countOf(binding.unused, 'data item')} not shown — no node left for ${binding.unused === 1 ? 'it' : 'them'}${binding.unusedItems?.length ? ':' : '.'}`)
  }

  return { level: notes.length ? 'warning' : 'ok', summary, notes, suggestions: [] }
}

/** `remove` / `patch` selectors of a section that matched no node: text and corrected selectors that hit. */
export function layoutSelectorMessages(diagnosis: SectionDiagnosis | undefined): { text: string; suggestions: string[] }[] {
  return (diagnosis?.layout ?? []).map(({ kind, selector, suggestions }) => ({
    text:
      kind === 'patch'
        ? `patch “${selector}” matches no node in this section — it has no effect.`
        : `remove “${selector}” matches no node in this section — nothing is removed.`,
    suggestions,
  }))
}

/** `resolve` issues of the nodes of a section: `component ID: message`. */
export function nodeIssueMessages(payload: DevtoolsPayload, sectionKey: string): string[] {
  return Object.values(payload.nodes)
    .filter(node => node.section === sectionKey && node.issues.length)
    .flatMap(node => node.issues.map(issue => `${node.component} ${node.id}: ${issue}`))
}

/** Dropped data grouped by the removed parent. */
export function droppedMessages(diagnosis: SectionDiagnosis | undefined): string[] {
  const byParent = new Map<string, string[]>()
  for (const { id, with: parent } of diagnosis?.dropped ?? []) byParent.set(parent ?? '?', [...(byParent.get(parent ?? '?') ?? []), id])
  return [...byParent].map(
    ([parent, ids]) => `${ids.join(', ')} had data, but their parent ${parent} was removed (nothing to fill it with) — the data is not shown.`
  )
}

// ---------- timing

/** What a query cache status means for this call. */
export const QUERY_STATUS: Record<QueryTiming['status'], string> = {
  hit: 'from cache (fresh)',
  stale: 'from cache (stale) — refreshing in the background',
  miss: 'fetched — not in the cache or expired',
  bypass: 'fetched — the query has no cache key',
  error: 'failed',
}

/** Query key for display: without the `query` namespace (`["articles",12]`). */
export function queryLabel(key: string): string {
  if (!key) return '(no key)'
  try {
    const parts = JSON.parse(key) as unknown[]
    return JSON.stringify(parts[0] === 'query' ? parts.slice(1) : parts)
  } catch {
    return key
  }
}

/** Summary of query statuses, e.g. `3 hit · 1 stale · 1 miss`. */
export function querySummary(timing: BuildTiming): string | undefined {
  if (!timing.queries) return undefined
  const counts = new Map<string, number>()
  for (const { status } of timing.queries) counts.set(status, (counts.get(status) ?? 0) + 1)
  return [...counts].map(([status, count]) => `${count} ${status}`).join(' · ') || 'none (no ui.query was called during this build)'
}

/** Shown when query calls are missing from a timing. */
export const NO_QUERY_TIMINGS =
  'query calls need AsyncLocalStorage — global in Next.js and edge runtimes; elsewhere pass createDedal({ AsyncLocalStorage }) from node:async_hooks'

// ---------- text report (copy report)

const ICONS = { error: '✗', warning: '!', info: '·', ok: '✓' } as const

/**
 * Plain-text report of a payload — for bug reports and chats: page messages, sections with problems (bindings, patch /
 * remove selectors, dropped data) and timings. Sections without problems are only counted.
 */
export function reportText(payload: DevtoolsPayload, options: { title?: string; extra?: DevtoolsMessage[] } = {}): string {
  const lines: string[] = [options.title ?? 'dedal devtools report', '']
  const message = (m: DevtoolsMessage) =>
    `${ICONS[m.level]} ${m.subject ? `${m.subject} ` : ''}${m.text}${m.suggestions?.length ? ` Did you mean: ${m.suggestions.join(', ')}?` : ''}`

  const pageList = [...(options.extra ?? []), ...pageMessages(payload)]
  const clean = !pageList.some(({ level }) => level !== 'info')
  lines.push('page', ...pageList.map(m => `  ${message(m)}`), ...(clean ? ['  no problems'] : []), '')

  let quiet = 0
  for (const section of payload.sections) {
    const bindings = (section.report?.bindings ?? []).map(binding => ({
      binding,
      ...bindingMessages(binding, section.diagnosis?.unmatched.find(problem => problem.selector === binding.selector)),
    }))
    const layout = layoutSelectorMessages(section.diagnosis)
    const dropped = droppedMessages(section.diagnosis)
    const problems = bindings.filter(({ level }) => level !== 'ok')
    const issues = nodeIssueMessages(payload, section.key)

    if (!problems.length && !layout.length && !dropped.length && !issues.length) {
      quiet++
      continue
    }

    lines.push(`section ${section.key}${section.removed ? ' (removed — no data)' : ''} — source: ${section.source ?? '?'}`)
    for (const { binding, level, summary, notes, suggestions } of problems) {
      lines.push(`  ${ICONS[level]} ${binding.selector} — ${summary}`)
      notes.forEach((note, i) => lines.push(`      ${note}${i === 0 && suggestions.length ? ` Did you mean: ${suggestions.join(', ')}?` : ''}`))
      for (const item of binding.unusedItems ?? []) lines.push(`        [${item.index}] ${item.preview}`)
    }
    for (const { text, suggestions } of layout) lines.push(`  ! ${text}${suggestions.length ? ` Did you mean: ${suggestions.join(', ')}?` : ''}`)
    for (const text of dropped) lines.push(`  ! ${text}`)
    for (const text of issues) lines.push(`  ✗ ${text}`)
    lines.push('')
  }
  if (quiet) lines.push(`${quiet} section${quiet === 1 ? '' : 's'} without problems`, '')

  for (const timing of payload.page.timings ?? []) {
    lines.push(
      `timing ${timing.scope === 'page' ? 'page build' : `section ${timing.scope}`} — ${timing.total} ms (layout ${timing.layout} · data loading ${timing.load} · assign ${timing.assign})`
    )
    for (const loader of [...timing.loaders].sort((a, b) => b.duration - a.duration)) {
      lines.push(`  ${loader.loader === 'page' ? 'page data' : loader.loader} ${loader.duration} ms${loader.failed ? ' — failed' : ''}`)
      for (const query of (timing.queries ?? []).filter(query => query.loader === loader.loader)) {
        lines.push(`    query ${queryLabel(query.key)} ${query.status} ${query.duration} ms`)
      }
    }
    const summary = querySummary(timing)
    lines.push(`  queries — ${summary ?? 'not recorded (no AsyncLocalStorage)'}`, '')
  }

  return lines.join('\n').trimEnd() + '\n'
}

// ---------- tree search

/** A node whose data contains the searched text: the field path and the matching value (shortened). */
export type DataMatch = { id: string; path: string; value: string }

/** A data item that did not reach the page and contains the searched text (only its preview is searched). */
export type LostMatch = { section: string; selector: string; index: number; preview: string }

/** Tree search result: by selector, by ID / section / alias, by data values; plus matching data that is not on the page. */
export type NodeSearch = { bySelector: string[]; byText: string[]; byData: DataMatch[]; lost: LostMatch[]; error?: string }

/** Text in data: at least 2 characters (shorter would match almost everything). */
const DATA_MIN = 2

/** First string / number / boolean leaf containing `needle` — its path (`headline`, `author.name`, `tags[0]`) and value. */
function findInData(value: unknown, needle: string, path = ''): { path: string; value: string } | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value)
    return text.toLowerCase().includes(needle) ? { path: path || '(value)', value: text.length > 60 ? `${text.slice(0, 59)}…` : text } : undefined
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findInData(item, needle, `${path}[${index}]`)
      if (found) return found
    }
    return undefined
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const found = findInData(item, needle, path ? `${path}.${key}` : key)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Searches nodes on the page (sections removed by data are skipped): as a selector (the same matcher as patch / assign),
 * as text in the node ID, section key and alias, and as text in node data — so `card`, `#featured`, `news`, `news.0.1`
 * and a headline all find something. Data items that did not reach the page are searched by their preview.
 */
export function searchNodes(payload: DevtoolsPayload, query: string): NodeSearch {
  const text = query.trim()
  if (!text) return { bySelector: [], byText: [], byData: [], lost: [] }

  let bySelector: string[] = []
  let error: string | undefined
  try {
    bySelector = selectNodes(payload, text)
  } catch (thrown) {
    error = (thrown as Error).message
  }

  const needle = text.replace(/^#/, '').toLowerCase()
  const onPage = new Set(payload.sections.filter(({ removed }) => !removed).map(({ key }) => key))
  const nodes = Object.values(payload.nodes).filter(node => onPage.has(node.section))
  const found = new Set(bySelector)

  const byText = nodes
    .filter(node => !found.has(node.id) && [node.id, node.section, node.alias ?? ''].some(value => value.toLowerCase().includes(needle)))
    .map(node => node.id)
  byText.forEach(id => found.add(id))

  const dataNeedle = text.toLowerCase()
  const byData: DataMatch[] = []
  const lost: LostMatch[] = []
  if (dataNeedle.length >= DATA_MIN) {
    for (const node of nodes) {
      if (found.has(node.id) || !node.data) continue
      const match = findInData(node.data.value, dataNeedle)
      if (match) byData.push({ id: node.id, ...match })
    }
    for (const section of payload.sections) {
      for (const binding of section.report?.bindings ?? []) {
        for (const item of binding.unusedItems ?? []) {
          if (item.preview.toLowerCase().includes(dataNeedle)) {
            lost.push({ section: section.key, selector: binding.selector, index: item.index, preview: item.preview })
          }
        }
      }
    }
  }

  return { bySelector, byText, byData, lost, ...(error !== undefined && { error }) }
}

/** One-line description of a tree search result. */
export function searchSummary(search: NodeSearch, query: string): { text: string; error?: string } {
  const count = (n: number) => `${n} node${n === 1 ? '' : 's'}`
  const parts: string[] = []
  if (search.bySelector.length) parts.push(`${count(search.bySelector.length)} match the selector`)
  if (search.byText.length) parts.push(`${count(search.byText.length)} with “${query.trim()}” in the ID / section / alias`)
  if (search.byData.length) parts.push(`${count(search.byData.length)} with “${query.trim()}” in their data`)

  if (!parts.length) {
    const lost = search.lost.length ? ` Found only in data that is not on the page (${search.lost.length}).` : ''
    return {
      text: `No node matches — not a component, alias, ID, section or data on this page.${lost}`,
      ...(search.error !== undefined && { error: search.error }),
    }
  }
  return { text: `${parts.join(' · ')} — highlighted on the page` }
}
