import type { ContractDefinition, InferContract } from '../contract'
import { contractToJsonSchema } from '../json-schema'
import type { BlockDefinition, ComponentName, PropsOf } from '../types'
import { validateTemplate, type ValidationError } from '../validate'

// ---- the Figma REST API shape (GET /v1/files/:key/nodes) — the fields the converter reads

/** A component property of an instance: `Label#3:0 → { type: 'TEXT', value: 'Get started' }`. */
export type FigmaProperty = { type: string; value: unknown }

/** A node of a Figma file, as the REST API returns it (only what the converter reads). */
export type FigmaNode = {
  id: string
  name: string
  type: string
  visible?: boolean
  /** Instances: the main component's id — resolved to a name through `components` / `componentSets`. */
  componentId?: string
  componentProperties?: Record<string, FigmaProperty>
  /** Text layers: their content. */
  characters?: string
  children?: FigmaNode[]
}

/** One entry of a nodes response: the node and the maps from component ids to names. */
export type FigmaNodeEntry = {
  document: FigmaNode
  components: Record<string, { name: string; componentSetId?: string }>
  componentSets: Record<string, { name: string }>
}

/** The response of `GET /v1/files/:key/nodes?ids=…`. */
export type FigmaNodesResponse = { nodes: Record<string, FigmaNodeEntry | null> }

// ---- where a prop comes from

type SourceContext = {
  node: FigmaNode
  property: (name: string) => FigmaProperty | undefined
  componentName: (componentId: string) => string | undefined
  textLayer: (name: string) => string | undefined
}

/** Where a prop's value comes from in Figma — `text`, `variant`, `boolean`, `swap` or `layer`. */
export type FigmaSource = {
  /** The Figma property (or text layer) it reads — excluded from the convention. */
  readonly reads: string
  readonly read: (context: SourceContext) => unknown
}

/** A `TEXT` component property → a string prop (`figma.string` in Code Connect). */
export const text = (property: string): FigmaSource => ({
  reads: property,
  read: ({ property: get }) => {
    const value = get(property)?.value
    return typeof value === 'string' ? value : undefined
  },
})

/** A `VARIANT` component property → a prop; `values` maps Figma's values to the contract's (`figma.enum`). */
export const variant = (property: string, values?: Record<string, unknown>): FigmaSource => ({
  reads: property,
  read: ({ property: get }) => {
    const value = get(property)?.value
    return values && typeof value === 'string' && Object.hasOwn(values, value) ? values[value] : value
  },
})

/** A `BOOLEAN` component property → a prop; `values` maps `true` / `false` to the contract's (`figma.boolean`). */
export const boolean = (property: string, values?: { true?: unknown; false?: unknown }): FigmaSource => ({
  reads: property,
  read: ({ property: get }) => {
    const value = get(property)?.value
    if (typeof value !== 'boolean') return undefined
    return values ? values[value ? 'true' : 'false'] : value
  },
})

/**
 * An `INSTANCE_SWAP` component property → the swapped component's name, or a value derived from it
 * (`swap('Icon', name => name.replace('icon/', ''))` → `'braces'`).
 */
export const swap = (property: string, toValue: (componentName: string) => unknown = name => name): FigmaSource => ({
  reads: property,
  read: ({ property: get, componentName }) => {
    const id = get(property)?.value
    const name = typeof id === 'string' ? componentName(id) : undefined
    return name === undefined ? undefined : toValue(name)
  },
})

/** The content of a text layer inside the node (`figma.textContent` in Code Connect). */
export const layer = (name: string): FigmaSource => ({
  reads: name,
  read: ({ textLayer }) => textLayer(name),
})

// ---- the mapping

type Props<D extends ContractDefinition, K extends ComponentName<InferContract<D>>> = {
  [P in keyof PropsOf<InferContract<D>, K>]?: FigmaSource
}

type ComponentEntry = { kind: 'component'; figma: string; props: Record<string, FigmaSource | undefined> }
type FrameEntry = { kind: 'frame'; figma: string | RegExp; props: Record<string, FigmaSource | undefined> }

/** A Figma component (or component set) → this contract component; props not listed follow the convention. */
export const component = (figmaName: string, props: Record<string, FigmaSource | undefined> = {}): ComponentEntry => ({
  kind: 'component',
  figma: figmaName,
  props,
})

/** A plain Figma frame (by name, or a pattern) → this contract component; its content from text layers. */
export const frame = (figmaName: string | RegExp, props: Record<string, FigmaSource | undefined> = {}): FrameEntry => ({
  kind: 'frame',
  figma: figmaName,
  props,
})

export type FigmaMappingOptions = {
  /** Turns a Figma component name into the name the mapping looks for — e.g. drops a library suffix: `Button (Radix)` → `Button`. */
  componentName?: (name: string) => string
  /**
   * A container component for a section whose frame isn't mapped and holds several blocks — they become its children.
   * Without it, such a section is an error.
   */
  section?: string
}

/** A layer that didn't become part of the template, and why. */
export type Unmapped = { path: string; reason: string }

export type FigmaConversion<C> =
  | { ok: true; sections: Record<string, BlockDefinition<C>>; errors: []; unmapped: Unmapped[] }
  | { ok: false; sections: Record<string, unknown>; errors: ValidationError[]; unmapped: Unmapped[] }

/** Names compared without case, spaces, dashes and underscores: `section-heading` = `sectionHeading`. */
const normalize = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, '')
/** Figma property names carry an id: `Label#3:0` → `Label`. */
const baseName = (property: string) => property.replace(/#[^#]*$/, '')
const camel = (name: string) => name.trim().replace(/[\s_-]+(.)/g, (_, char: string) => char.toUpperCase()).replace(/^./, char => char.toLowerCase())
const visible = (node: FigmaNode) => node.visible !== false
/** Child paths: `parent/name`, with an index when siblings share the name (`pipeline-step[2]`). */
const childPaths = (node: FigmaNode, path: string) => {
  const children = node.children ?? []
  const count = new Map<string, number>()
  for (const child of children) count.set(child.name, (count.get(child.name) ?? 0) + 1)
  const seen = new Map<string, number>()
  return children.map(child => {
    const index = seen.get(child.name) ?? 0
    seen.set(child.name, index + 1)
    return [child, `${path}/${child.name}${count.get(child.name)! > 1 ? `[${index}]` : ''}`] as const
  })
}
const CONTAINERS = new Set(['FRAME', 'GROUP', 'SECTION', 'COMPONENT'])

/**
 * A Figma → template mapping for a contract: a Figma component or frame per contract component, by convention or
 * explicitly. `convert` turns a frame of a Figma file into templates, one per section, validated against the contract.
 *
 * @example
 * ```ts
 * const fromFigma = mapping(contract, {
 *   button: component('Button', { label: text('Label'), iconRight: boolean('Icon right') }),
 *   hero: frame('hero', { title: layer('title'), lead: layer('lead') }),
 * })
 * const { ok, sections, errors, unmapped } = await fromFigma.convert(response, '5:2')
 * ```
 */
export function mapping<const D extends ContractDefinition>(
  contract: D,
  entries: { [K in ComponentName<InferContract<D>>]?: (ComponentEntry | FrameEntry) & { props: Props<D, K> } },
  options: FigmaMappingOptions = {}
) {
  type C = InferContract<D>
  const keys = Object.keys(contract)
  const schemas = contractToJsonSchema(contract).props
  /** Prop names the contract declares for a component — `undefined` when its schema couldn't be read (then all are kept). */
  const knownProps = (key: string) => {
    const properties = schemas[key]?.properties
    return properties && typeof properties === 'object' ? new Set(Object.keys(properties)) : undefined
  }

  const components = new Map<string, { key: string; props: Record<string, FigmaSource | undefined> }>()
  const frames: { key: string; figma: string | RegExp; props: Record<string, FigmaSource | undefined> }[] = []
  for (const [key, entry] of Object.entries(entries) as [string, ComponentEntry | FrameEntry][]) {
    if (!Object.hasOwn(contract, key)) throw new Error(`figma mapping: "${key}" is not in the contract`)
    const known = knownProps(key)
    for (const prop of Object.keys(entry.props)) {
      if (known && !known.has(prop)) throw new Error(`figma mapping: "${key}" has no prop "${prop}" in the contract (props: ${[...known].join(', ')})`)
    }
    if (entry.kind === 'component') components.set(normalize(entry.figma), { key, props: entry.props })
    else frames.push({ key, figma: entry.figma, props: entry.props })
  }
  // the convention: a contract component not mapped explicitly is found by its own name
  for (const key of keys) {
    if (!Object.hasOwn(entries, key) && !components.has(normalize(key))) components.set(normalize(key), { key, props: {} })
  }
  const frameFor = (name: string) =>
    frames.find(({ figma }) => (typeof figma === 'string' ? normalize(figma) === normalize(name) : figma.test(name))) ??
    (keys.some(key => normalize(key) === normalize(name)) && !Object.hasOwn(entries, keys.find(key => normalize(key) === normalize(name))!)
      ? { key: keys.find(key => normalize(key) === normalize(name))!, figma: name, props: {} }
      : undefined)

  const convertEntry = (entry: FigmaNodeEntry) => {
    const unmapped: Unmapped[] = []
    const componentName = (componentId: string) => {
      const meta = entry.components[componentId]
      if (!meta) return undefined
      return meta.componentSetId ? entry.componentSets[meta.componentSetId]?.name : meta.name
    }
    const lookupName = (name: string) => normalize(options.componentName ? options.componentName(name) : name)

    /** Text layers of a node, down to (not into) instances and mapped frames. */
    const textsOf = (node: FigmaNode, into: FigmaNode[] = []): FigmaNode[] => {
      for (const child of node.children ?? []) {
        if (!visible(child)) continue
        if (child.type === 'TEXT') into.push(child)
        else if (child.type !== 'INSTANCE' && !(CONTAINERS.has(child.type) && frameFor(child.name))) textsOf(child, into)
      }
      return into
    }

    const propsOf = (key: string, node: FigmaNode, explicit: Record<string, FigmaSource | undefined>, texts: FigmaNode[]) => {
      const properties = node.componentProperties ?? {}
      const property = (name: string) =>
        Object.entries(properties).find(([figmaName]) => normalize(baseName(figmaName)) === normalize(name))?.[1]
      const textLayer = (name: string) => texts.find(text => normalize(text.name) === normalize(name))?.characters
      const context: SourceContext = { node, property, componentName, textLayer }
      const known = knownProps(key)
      const props: Record<string, unknown> = {}
      const used = new Set<string>()

      for (const [prop, source] of Object.entries(explicit)) {
        if (!source) continue
        used.add(normalize(source.reads))
        const value = source.read(context)
        if (value !== undefined) props[prop] = value
      }
      // the convention: properties and text layers named like a prop the contract declares
      for (const [figmaName, { type, value }] of Object.entries(properties)) {
        const name = baseName(figmaName)
        const prop = camel(name)
        if (used.has(normalize(name)) || Object.hasOwn(props, prop) || (known && !known.has(prop))) continue
        if (type === 'INSTANCE_SWAP') {
          const swapped = typeof value === 'string' ? componentName(value) : undefined
          if (swapped !== undefined) props[prop] = swapped
        } else if (type === 'TEXT' || type === 'BOOLEAN' || type === 'VARIANT') props[prop] = value
      }
      const consumed = new Set<FigmaNode>()
      for (const text of texts) {
        const prop = camel(text.name)
        if (used.has(normalize(text.name))) consumed.add(text)
        else if (!Object.hasOwn(props, prop) && known?.has(prop) && text.characters !== undefined) {
          props[prop] = text.characters
          consumed.add(text)
        }
      }
      return { props, consumed }
    }

    /** A node → blocks: one for a mapped component or frame, the children of a plain layout frame, none for the rest. */
    const convert = (node: FigmaNode, path: string): unknown[] => {
      if (!visible(node)) return []
      if (node.type === 'INSTANCE') {
        const name = node.componentId ? componentName(node.componentId) : undefined
        const target = name !== undefined ? components.get(lookupName(name)) : undefined
        if (!target) {
          unmapped.push({ path, reason: `an instance of "${name ?? node.name}", which no contract component maps` })
          return []
        }
        // an instance's own layers belong to the component; only its texts can be read as props
        const { props } = propsOf(target.key, node, target.props, textsOf(node))
        return [{ component: target.key, ...(Object.keys(props).length && { props }) }]
      }
      if (node.type === 'TEXT') {
        unmapped.push({ path, reason: 'a text layer outside any mapped component — map it with layer() or a frame' })
        return []
      }
      if (!CONTAINERS.has(node.type)) return [] // vectors, shapes: visual only
      const target = frameFor(node.name)
      if (!target) return childPaths(node, path).flatMap(([child, childPath]) => convert(child, childPath)) // layout only
      const texts = textsOf(node)
      const { props, consumed } = propsOf(target.key, node, target.props, texts)
      const children = childPaths(node, path).flatMap(([child, childPath]) => convertChild(child, childPath, consumed))
      return [{ component: target.key, ...(Object.keys(props).length && { props }), ...(children.length && { children }) }]
    }

    /** Inside a mapped frame, text layers already read as props are skipped (also inside plain layout frames). */
    const convertChild = (node: FigmaNode, path: string, consumed: Set<FigmaNode>): unknown[] => {
      if (consumed.has(node)) return []
      if (CONTAINERS.has(node.type) && !frameFor(node.name) && visible(node)) {
        return childPaths(node, path).flatMap(([child, childPath]) => convertChild(child, childPath, consumed))
      }
      return convert(node, path)
    }

    const sections: Record<string, unknown> = {}
    const errors: ValidationError[] = []
    for (const child of (entry.document.children ?? []).filter(visible)) {
      let key = child.name
      for (let i = 2; Object.hasOwn(sections, key); i++) key = `${child.name}-${i}`
      const blocks = convert(child, child.name)
      if (blocks.length === 1) sections[key] = blocks[0]
      else if (blocks.length > 1 && options.section) sections[key] = { component: options.section, children: blocks }
      else if (blocks.length > 1) errors.push({ path: key, message: `the section frame "${child.name}" holds ${blocks.length} blocks — map the frame to a component, or set the section option` })
      else unmapped.push({ path: child.name, reason: 'a section with nothing mapped in it' })
    }
    return { sections, errors, unmapped }
  }

  return {
    /** Converts a node of a nodes response (`GET /v1/files/:key/nodes?ids=…`): its top-level layers become sections. */
    async convert(response: FigmaNodesResponse, nodeId: string): Promise<FigmaConversion<C>> {
      const entry = response.nodes[nodeId] ?? response.nodes[nodeId.replace('-', ':')]
      if (!entry) throw new Error(`figma: node "${nodeId}" is not in the response (nodes: ${Object.keys(response.nodes).join(', ')})`)
      const { sections, errors, unmapped } = convertEntry(entry)
      const validation = (await Promise.all(Object.entries(sections).map(([key, block]) => validateTemplate(contract, block, key)))).flat()
      const all = [...errors, ...validation]
      return all.length
        ? { ok: false, sections, errors: all, unmapped }
        : { ok: true, sections: sections as Record<string, BlockDefinition<C>>, errors: [], unmapped }
    },
  }
}
