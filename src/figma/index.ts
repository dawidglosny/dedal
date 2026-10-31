import type { ContractDefinition, InferContract } from '../contract'
import { contractToJsonSchema } from '../json-schema'
import type { BlockDefinition, ComponentName } from '../types'
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
  /** Which component property a layer is bound to — for a native slot: `{ slotContentId: 'Links#30:6' }`. */
  componentPropertyReferences?: Record<string, string>
  /** Text layers: their content. */
  characters?: string
  /** Fills — an image fill carries an `imageRef`, resolved to a URL through `GET /v1/files/:key/images`. */
  fills?: { type: string; visible?: boolean; imageRef?: string }[]
  /** Styles applied to the node, by kind: `{ text: '2:36' }` — resolved to a name through the entry's `styles`. */
  styles?: Record<string, string>
  children?: FigmaNode[]
}

/** One entry of a nodes response: the node and the maps from component and style ids to names. */
export type FigmaNodeEntry = {
  document: FigmaNode
  components: Record<string, { name: string; componentSetId?: string }>
  componentSets: Record<string, { name: string }>
  /** Styles used in the node: `'2:36' → { name: 'h1', styleType: 'TEXT' }`. */
  styles?: Record<string, { name: string; styleType?: string }>
}

/** The response of `GET /v1/files/:key/nodes?ids=…`. */
export type FigmaNodesResponse = { nodes: Record<string, FigmaNodeEntry | null> }

// ---- where a prop comes from

/** A component, as an instance swap resolves it: its own name and, for a variant, the name of its component set. */
export type FigmaComponentRef = { name: string; set?: string }

type SourceContext = {
  node: FigmaNode
  /** A component property by name (`Label` finds `Label#3:0`). */
  property: (name: string) => FigmaProperty | undefined
  /** A component by id. */
  component: (componentId: string) => FigmaComponentRef | undefined
  /** The content of the first text layer with this name not read yet — reading it takes it out of the conversion. */
  textLayer: (name: string) => string | undefined
}

/** Where a prop's value comes from in Figma — `text`, `variant`, `boolean`, `swap` or `layer`. */
export type FigmaSource = {
  readonly read: (context: SourceContext) => unknown
}

/** A `TEXT` component property → a string prop (`figma.string` in Code Connect). */
export const text = (property: string): FigmaSource => ({
  read: ({ property: get }) => {
    const value = get(property)?.value
    return typeof value === 'string' ? value : undefined
  },
})

/** A `VARIANT` component property → a prop; `values` maps Figma's values to the contract's (`figma.enum`). */
export const variant = (property: string, values?: Record<string, unknown>): FigmaSource => ({
  read: ({ property: get }) => {
    const value = get(property)?.value
    return values && typeof value === 'string' && Object.hasOwn(values, value) ? values[value] : value
  },
})

/** A `BOOLEAN` component property → a prop; `values` maps `true` / `false` to the contract's (`figma.boolean`). */
export const boolean = (property: string, values?: { true?: unknown; false?: unknown }): FigmaSource => ({
  read: ({ property: get }) => {
    const value = get(property)?.value
    if (typeof value !== 'boolean') return undefined
    return values ? values[value ? 'true' : 'false'] : value
  },
})

/**
 * An `INSTANCE_SWAP` component property → the swapped component's name, or a value derived from it
 * (`swap('Icon', name => name.replace('icon/', ''))` → `'braces'`). The name is the component set's for a variant;
 * the second argument tells variants apart (`(set, { name }) => name.replace('name=', '')`).
 */
export const swap = (
  property: string,
  toValue: (name: string, component: FigmaComponentRef) => unknown = name => name
): FigmaSource => ({
  read: ({ property: get, component }) => {
    const id = get(property)?.value
    const ref = typeof id === 'string' ? component(id) : undefined
    return ref === undefined ? undefined : toValue(ref.set ?? ref.name, ref)
  },
})

/** The content of a text layer inside the node (`figma.textContent` in Code Connect). */
export const layer = (name: string): FigmaSource => ({
  read: ({ textLayer }) => textLayer(name),
})

/** The prefix of an image reference in a converted template: `figma-image:<imageRef>` — see `image()`. */
export const FIGMA_IMAGE = 'figma-image:'

/**
 * The node's image fill → `figma-image:<imageRef>`. Figma gives image URLs only through a separate request, and they
 * expire — `dedal-figma pull --images <dir>` downloads the images and replaces these values with local paths.
 */
export const image = (): FigmaSource => ({
  read: ({ node }) => {
    const fill = node.fills?.find(fill => fill.type === 'IMAGE' && fill.visible !== false && fill.imageRef)
    return fill ? `${FIGMA_IMAGE}${fill.imageRef}` : undefined
  },
})

/** Every `figma-image:<ref>` value in converted templates — the image references to download. */
export function imageRefs(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string' && value.startsWith(FIGMA_IMAGE)) into.add(value.slice(FIGMA_IMAGE.length))
  else if (Array.isArray(value)) for (const item of value) imageRefs(item, into)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) imageRefs(item, into)
  return into
}

/** A copy of converted templates with `figma-image:<ref>` values replaced (`ref → URL or path`). */
export function replaceImageRefs<T>(value: T, urls: Record<string, string>): T {
  if (typeof value === 'string' && value.startsWith(FIGMA_IMAGE)) return (urls[value.slice(FIGMA_IMAGE.length)] ?? value) as T
  if (Array.isArray(value)) return value.map(item => replaceImageRefs(item, urls)) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceImageRefs(item, urls)])) as T
  return value
}

// ---- the mapping

type SourceMap = Record<string, FigmaSource | undefined>

/**
 * Where the content of a component's native Figma slots goes. By default a slot named like a contract slot fills it, and
 * any other slot becomes the block's children.
 */
export type FigmaSlots = {
  /** Contract slot → the Figma slot it's filled from: `{ media: 'Media' }`. */
  slots?: Record<string, string>
  /** The Figma slot(s) whose content becomes the block's children — the others are reported. */
  children?: string | string[]
}

export type ComponentEntry<P extends SourceMap = SourceMap> = { kind: 'component'; figma: string; props: P; structure?: FigmaSlots }
export type FrameEntry<P extends SourceMap = SourceMap> = { kind: 'frame'; figma: string | RegExp; props: P }

/** A Figma component (or component set) → this contract component; props not listed follow the convention. */
export const component = <const P extends SourceMap = {}>(figmaName: string, props: P = {} as P, structure?: FigmaSlots): ComponentEntry<P> => ({
  kind: 'component',
  figma: figmaName,
  props,
  ...(structure && { structure }),
})

/** A plain Figma frame (by name, or a pattern) → this contract component; its content from text layers. */
export const frame = <const P extends SourceMap = {}>(figmaName: string | RegExp, props: P = {} as P): FrameEntry<P> => ({
  kind: 'frame',
  figma: figmaName,
  props,
})

/** The keys of every member of a union (`keyof` alone gives only the common ones). */
type KeysOfUnion<T> = T extends unknown ? keyof T : never

/** Each entry's props checked against the contract: an unknown prop name is a compile error. */
type CheckedEntries<C, E> = {
  [K in keyof E]: K extends ComponentName<C>
    ? E[K] extends ComponentEntry<infer P> | FrameEntry<infer P>
      ? E[K] & { props: { [Q in keyof P]: Q extends KeysOfUnion<C[K & keyof C]> ? P[Q] : never } }
      : never
    : never
}

export type FigmaMappingOptions = {
  /**
   * Turns a Figma component name into the name the mapping looks for — e.g. drops a library suffix: `Button (Radix)` →
   * `Button`. Applied to the names in `component()` too.
   */
  componentName?: (name: string) => string
  /**
   * A container component for a section whose frame isn't mapped and holds several blocks — they become its children.
   * Without it, such a section is an error.
   */
  section?: string
  /**
   * A component for text layers outside any mapped component — e.g. a section of plain text. It gets `text` (the
   * content) and, when the contract declares it, `style` (the name of the layer's Figma text style: `h2`, `body`).
   * Without it, such layers are reported in `unmapped`.
   */
  text?: string
  /**
   * Layers to skip whole, by name or pattern — decorative mock-ups, diagrams, illustrations. Nothing inside them becomes
   * part of the template; each one is reported once in `unmapped`.
   */
  ignore?: (string | RegExp)[]
}

/** A layer that didn't become part of the template, and why. */
export type Unmapped = { path: string; reason: string }

/** Something in the template that matches the contract but probably not the design — e.g. an empty container. */
export type FigmaWarning = { path: string; message: string }

/** A validation error: the path in the template, and the path of the Figma layer the block came from. */
export type FigmaError = ValidationError & { figma?: string }

export type FigmaConversion<C> =
  | { ok: true; sections: Record<string, BlockDefinition<C>>; errors: []; unmapped: Unmapped[]; warnings: FigmaWarning[] }
  | { ok: false; sections: Record<string, unknown>; errors: FigmaError[]; unmapped: Unmapped[]; warnings: FigmaWarning[] }

/** Names compared without case, spaces, dashes and underscores: `section-heading` = `sectionHeading`. */
const normalize = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, '')
/** Figma property names carry an id: `Label#3:0` → `Label`. */
const baseName = (property: string) => property.replace(/#[^#]*$/, '')
const visible = (node: FigmaNode) => node.visible !== false
/** A name or a pattern → a test; patterns lose `g` / `y`, which would make `test` stateful. */
const matcher = (pattern: string | RegExp) => {
  if (typeof pattern === 'string') return (name: string) => normalize(pattern) === normalize(name)
  const regexp = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
  return (name: string) => regexp.test(name)
}
/** Sets a key even when it's `__proto__`. */
const assign = (target: Record<string, unknown>, key: string, value: unknown) =>
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
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
/** Layers frame() can map — even when empty. */
const FRAMES = new Set(['FRAME', 'GROUP', 'SECTION', 'COMPONENT', 'COMPONENT_SET'])
/** A layer that holds other layers and isn't an instance — a frame, a group, a section, a component set… */
const isContainer = (node: FigmaNode) => node.type !== 'INSTANCE' && node.type !== 'TEXT' && (node.children?.length ?? 0) > 0

/**
 * A Figma → template mapping for a contract: a Figma component per contract component (by convention — the same
 * name — or explicitly), and plain frames mapped explicitly by name. `convert` turns a frame of a Figma file into
 * templates, one per section, validated against the contract.
 *
 * @example
 * ```ts
 * const fromFigma = mapping(contract, {
 *   button: component('Button', { label: text('Label'), iconRight: boolean('Icon right') }),
 *   hero: frame('hero', { title: layer('title'), lead: layer('lead') }),
 * })
 * const { ok, sections, errors, unmapped, warnings } = await fromFigma.convert(response, '5:2')
 * ```
 */
export function mapping<
  const D extends ContractDefinition,
  const E extends { [K in ComponentName<InferContract<D>>]?: ComponentEntry | FrameEntry } = {},
>(contract: D, entries: E & CheckedEntries<InferContract<D>, E>, options: FigmaMappingOptions = {}) {
  type C = InferContract<D>
  const keys = Object.keys(contract)
  const schemas = contractToJsonSchema(contract).props
  /** Prop names the contract declares for a component, by normalized name — `undefined` when its schema can't be read. */
  const propNames = new Map<string, Map<string, string> | undefined>()
  for (const key of keys) {
    const properties = schemas[key]?.properties
    propNames.set(key, properties && typeof properties === 'object' ? new Map(Object.keys(properties).map(prop => [normalize(prop), prop])) : undefined)
  }
  const lookupName = (name: string) => normalize(options.componentName ? options.componentName(name) : name)

  type Target = { key: string; props: SourceMap; structure?: FigmaSlots }
  const components = new Map<string, Target>()
  /** The slots a contract component declares: name → 'one' | 'many'. */
  const slotKinds = (key: string): Record<string, string> => (contract[key] as { slots?: Record<string, string> }).slots ?? {}
  const frames: { key: string; test: (name: string) => boolean; props: SourceMap }[] = []
  for (const [key, entry] of Object.entries(entries as Record<string, ComponentEntry | FrameEntry>)) {
    if (!Object.hasOwn(contract, key)) throw new Error(`figma mapping: "${key}" is not in the contract`)
    const known = propNames.get(key)
    for (const prop of Object.keys(entry.props)) {
      if (known && ![...known.values()].includes(prop)) throw new Error(`figma mapping: "${key}" has no prop "${prop}" in the contract (props: ${[...known.values()].join(', ')})`)
    }
    if (entry.kind === 'component') {
      const name = lookupName(entry.figma)
      const taken = components.get(name)
      if (taken) throw new Error(`figma mapping: "${key}" and "${taken.key}" both map the Figma component "${entry.figma}"`)
      for (const slotName of Object.keys(entry.structure?.slots ?? {})) {
        if (!Object.hasOwn(slotKinds(key), slotName)) throw new Error(`figma mapping: "${key}" has no slot "${slotName}" in the contract (slots: ${Object.keys(slotKinds(key)).join(', ') || 'none'})`)
      }
      components.set(name, { key, props: entry.props, ...(entry.structure && { structure: entry.structure }) })
    } else frames.push({ key, test: matcher(entry.figma), props: entry.props })
  }
  // the convention: a contract component not mapped explicitly is found by its own name — for component instances
  // only; plain frames are named freely (and mock-ups reuse names), so they map only through frame()
  const byConvention = new Map<string, string>()
  for (const key of keys) {
    if (Object.hasOwn(entries, key)) continue
    const name = normalize(key)
    const taken = byConvention.get(name)
    if (taken) throw new Error(`figma mapping: "${taken}" and "${key}" have the same name for Figma — map one of them with component()`)
    byConvention.set(name, key)
    if (!components.has(name)) components.set(name, { key, props: {} })
  }
  const frameFor = (name: string) => frames.find(({ test }) => test(name))
  const ignores = (options.ignore ?? []).map(matcher)
  const ignored = (node: FigmaNode) => ignores.some(test => test(node.name))
  if (options.section !== undefined && !Object.hasOwn(contract, options.section)) throw new Error(`figma mapping: the section component "${options.section}" is not in the contract`)
  if (options.text !== undefined) {
    if (!Object.hasOwn(contract, options.text)) throw new Error(`figma mapping: the text component "${options.text}" is not in the contract`)
    const known = propNames.get(options.text)
    if (known && !known.has('text')) throw new Error(`figma mapping: the text component "${options.text}" has no prop "text" in the contract`)
  }

  const convertEntry = (entry: FigmaNodeEntry) => {
    const unmapped: Unmapped[] = []
    const warnings: FigmaWarning[] = []
    /** Where each block came from in Figma — for validation errors. */
    const origins = new Map<object, string>()
    const block = (value: Record<string, unknown>, path: string) => (origins.set(value, path), value)

    const componentRef = (componentId: string): FigmaComponentRef | undefined => {
      const meta = entry.components[componentId]
      if (!meta) return undefined
      const set = meta.componentSetId ? entry.componentSets[meta.componentSetId]?.name : undefined
      return set === undefined ? { name: meta.name } : { name: meta.name, set }
    }
    const componentName = (componentId: string) => {
      const ref = componentRef(componentId)
      return ref && (ref.set ?? ref.name)
    }
    const targetOf = (node: FigmaNode) => {
      const name = node.componentId ? componentName(node.componentId) : undefined
      return { name, target: name !== undefined ? components.get(lookupName(name)) : undefined }
    }

    /** Text layers of a node, down to (not into) instances, mapped frames and ignored layers. */
    const textsOf = (node: FigmaNode, into: FigmaNode[] = []): FigmaNode[] => {
      for (const child of node.children ?? []) {
        if (!visible(child) || ignored(child)) continue
        if (child.type === 'TEXT') into.push(child)
        else if (child.type !== 'SLOT' && isContainer(child) && !(FRAMES.has(child.type) && frameFor(child.name))) textsOf(child, into)
      }
      return into
    }

    /** Props of a mapped node: explicit sources first, then the convention; the text layers read are returned. */
    const propsOf = (key: string, node: FigmaNode, explicit: SourceMap, texts: FigmaNode[]) => {
      const properties = Object.entries(node.componentProperties ?? {})
      const usedProperties = new Set<string>()
      const consumed = new Set<FigmaNode>()
      const context: SourceContext = {
        node,
        property: name => {
          const found = properties.find(([figmaName]) => normalize(baseName(figmaName)) === normalize(name))
          if (found) usedProperties.add(found[0])
          return found?.[1]
        },
        component: componentRef,
        textLayer: name => {
          const found = texts.find(text => !consumed.has(text) && normalize(text.name) === normalize(name))
          if (found) consumed.add(found)
          return found?.characters
        },
      }
      const props: Record<string, unknown> = {}
      for (const [prop, source] of Object.entries(explicit)) {
        if (!source) continue
        const value = source.read(context)
        if (value !== undefined) assign(props, prop, value)
      }
      // the convention: properties and text layers named like a prop the contract declares — not for props mapped
      // explicitly (even when their source found nothing), and only when the contract's prop names can be read
      const known = propNames.get(key)
      if (known) {
        const free = (name: string) => {
          const prop = known.get(normalize(name))
          return prop !== undefined && !Object.hasOwn(explicit, prop) && !Object.hasOwn(props, prop) ? prop : undefined
        }
        for (const [figmaName, { type, value }] of properties) {
          const prop = usedProperties.has(figmaName) ? undefined : free(baseName(figmaName))
          if (prop === undefined) continue
          if (type === 'INSTANCE_SWAP') {
            const swapped = typeof value === 'string' ? componentName(value) : undefined
            if (swapped !== undefined) assign(props, prop, swapped)
          } else if (type === 'TEXT' || type === 'BOOLEAN' || type === 'VARIANT') assign(props, prop, value)
        }
        for (const text of texts) {
          const prop = consumed.has(text) || text.characters === undefined ? undefined : free(text.name)
          if (prop === undefined) continue
          assign(props, prop, text.characters)
          consumed.add(text)
        }
      }
      return { props, consumed }
    }

    /** Instances inside an instance that the mapping knows — their content isn't converted, so they're reported. */
    const reportNested = (node: FigmaNode, path: string, owner: string) => {
      for (const [child, childPath] of childPaths(node, path)) {
        if (!visible(child) || child.type === 'SLOT') continue
        if (child.type === 'INSTANCE' && targetOf(child).target) {
          unmapped.push({ path: childPath, reason: `inside an instance of "${owner}" — the content of an instance isn't converted; expose it as a component property` })
        } else reportNested(child, childPath, owner)
      }
    }

    /** The content of an instance's native slots → the block's slots (by name, or as mapped) and children. */
    const slotsOf = (target: Target, node: FigmaNode, path: string) => {
      const kinds = slotKinds(target.key)
      const explicit = target.structure?.slots ?? {}
      const childSlots = target.structure?.children === undefined ? undefined : [target.structure.children].flat().map(normalize)
      const slots: Record<string, unknown> = {}
      const children: Record<string, unknown>[] = []
      const intoChildren: string[] = []
      for (const [slot, slotPath] of childPaths(node, path)) {
        if (slot.type !== 'SLOT' || !visible(slot)) continue
        const figmaName = baseName(slot.componentPropertyReferences?.slotContentId ?? slot.name)
        const contractSlot =
          Object.keys(explicit).find(name => normalize(explicit[name]!) === normalize(figmaName)) ??
          Object.keys(kinds).find(name => !Object.hasOwn(explicit, name) && normalize(name) === normalize(figmaName))
        if (contractSlot === undefined && childSlots && !childSlots.includes(normalize(figmaName))) {
          unmapped.push({ path: slotPath, reason: `the slot "${figmaName}" of "${target.key}", which no contract slot maps` })
          continue
        }
        const blocks = childPaths(slot, slotPath).flatMap(([child, childPath]) => convert(child, childPath))
        if (contractSlot === undefined) {
          children.push(...blocks)
          intoChildren.push(figmaName)
        } else if (kinds[contractSlot] === 'many') {
          if (blocks.length) assign(slots, contractSlot, blocks)
        } else if (blocks.length) assign(slots, contractSlot, blocks.length === 1 ? blocks[0] : blocks) // several in a 'one' slot: validation says so
      }
      if (intoChildren.length > 1) warnings.push({ path, message: `the slots ${intoChildren.map(name => `"${name}"`).join(', ')} of "${target.key}" were merged into its children — map them with component(…, { slots, children })` })
      return { slots, children }
    }

    /**
     * A node → blocks: one for a mapped component or frame or a loose text, the blocks of a plain layout frame (in its
     * place), none for the rest. `consumed`: text layers already read as props of the enclosing mapped frame.
     */
    const convert = (node: FigmaNode, path: string, consumed?: Set<FigmaNode>): Record<string, unknown>[] => {
      if (!visible(node) || consumed?.has(node)) return []
      if (ignored(node)) {
        unmapped.push({ path, reason: 'ignored (the ignore option) — nothing inside it is converted' })
        return []
      }
      if (node.type === 'INSTANCE') {
        const { name, target } = targetOf(node)
        if (!target) {
          unmapped.push({ path, reason: `an instance of "${name ?? node.name}", which no contract component maps` })
          return []
        }
        // an instance's own layers belong to the component; only its texts can be read as props
        const { props } = propsOf(target.key, node, target.props, textsOf(node))
        reportNested(node, path, name!)
        const { slots, children } = slotsOf(target, node, path)
        return [block({ component: target.key, ...(Object.keys(props).length && { props }), ...(Object.keys(slots).length && { slots }), ...(children.length && { children }) }, path)]
      }
      if (node.type === 'TEXT') {
        if (options.text === undefined || node.characters === undefined) {
          unmapped.push({ path, reason: 'a text layer outside any mapped component — map it with layer() or a frame, or set the text option' })
          return []
        }
        const styleId = node.styles?.text
        const style = styleId !== undefined ? entry.styles?.[styleId]?.name : undefined
        const withStyle = style !== undefined && propNames.get(options.text)?.has('style')
        return [block({ component: options.text, props: { text: node.characters, ...(withStyle && { style }) } }, path)]
      }
      const target = FRAMES.has(node.type) ? frameFor(node.name) : undefined
      if (!target && !isContainer(node)) return [] // vectors, shapes, empty frames: visual only
      if (!target) return childPaths(node, path).flatMap(([child, childPath]) => convert(child, childPath, consumed)) // layout only
      const { props, consumed: read } = propsOf(target.key, node, target.props, textsOf(node))
      const children = childPaths(node, path).flatMap(([child, childPath]) => convert(child, childPath, read))
      if (!Object.keys(props).length && !children.length) warnings.push({ path, message: `an empty "${target.key}" — no props and no children came from the frame` })
      return [block({ component: target.key, ...(Object.keys(props).length && { props }), ...(children.length && { children }) }, path)]
    }

    const sections: Record<string, unknown> = {}
    const errors: FigmaError[] = []
    for (const child of (entry.document.children ?? []).filter(visible)) {
      let key = child.name
      for (let i = 2; Object.hasOwn(sections, key); i++) key = `${child.name}-${i}`
      const reported = unmapped.length
      const blocks = convert(child, key)
      if (blocks.length === 1) assign(sections, key, blocks[0])
      else if (blocks.length > 1 && options.section) assign(sections, key, block({ component: options.section, children: blocks }, key))
      else if (blocks.length > 1) errors.push({ path: key, figma: key, message: `the section frame "${child.name}" holds ${blocks.length} blocks — map the frame to a component, or set the section option` })
      else if (unmapped.length === reported) unmapped.push({ path: key, reason: 'a section with nothing mapped in it' })
    }

    /** Template path → Figma path, for every block. */
    const figmaPaths = new Map<string, string>()
    const walk = (value: unknown, at: string) => {
      if (!value || typeof value !== 'object') return
      const origin = origins.get(value)
      if (origin !== undefined) figmaPaths.set(at, origin)
      const { children, slots } = value as { children?: unknown; slots?: Record<string, unknown> }
      if (Array.isArray(children)) children.forEach((child, i) => walk(child, `${at}.children[${i}]`))
      for (const [name, content] of Object.entries(slots ?? {})) {
        if (Array.isArray(content)) content.forEach((child, i) => walk(child, `${at}.slots.${name}[${i}]`))
        else walk(content, `${at}.slots.${name}`)
      }
    }
    for (const [key, value] of Object.entries(sections)) walk(value, key)
    /** The Figma layer of the deepest block the template path is in. */
    const figmaOf = (path: string): string | undefined => {
      const found = figmaPaths.get(path)
      if (found !== undefined) return found
      const parent = path.replace(/(\.[^.[]+|\[\d+\])$/, '')
      return parent === path ? undefined : figmaOf(parent)
    }
    return { sections, errors, unmapped, warnings, figmaOf }
  }

  return {
    /** Converts a node of a nodes response (`GET /v1/files/:key/nodes?ids=…`): its top-level layers become sections. */
    async convert(response: FigmaNodesResponse, nodeId: string): Promise<FigmaConversion<C>> {
      const entry = response.nodes[nodeId] ?? response.nodes[nodeId.replaceAll('-', ':')]
      if (!entry) throw new Error(`figma: node "${nodeId}" is not in the response (nodes: ${Object.keys(response.nodes).join(', ')})`)
      const { sections, errors, unmapped, warnings, figmaOf } = convertEntry(entry)
      const validation = (await Promise.all(Object.entries(sections).map(([key, value]) => validateTemplate(contract, value, key)))).flat()
      const all: FigmaError[] = [
        ...errors,
        ...validation.map(error => {
          const figma = figmaOf(error.path)
          return figma === undefined ? error : { ...error, figma }
        }),
      ]
      return all.length
        ? { ok: false, sections, errors: all, unmapped, warnings }
        : { ok: true, sections: sections as Record<string, BlockDefinition<C>>, errors: [], unmapped, warnings }
    },
  }
}
