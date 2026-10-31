import type { ContractDefinition } from '../contract'
import type { FigmaPropertyDefinition } from './component'
import type { FigmaComponentRef, FigmaNode, FigmaSlots, FigmaSource, Unmapped } from './index'

/** A component of the Figma library: a component set or a standalone component, with its property definitions. */
export type FigmaLibraryComponent = {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET'
  definitions: Record<string, FigmaPropertyDefinition>
}

/** One thing for the plugin to create: an instance of a library component, or a text layer. */
export type FigmaBuildNode =
  | {
      kind: 'instance'
      /** The template path it comes from (`hero.children[0]`). */
      path: string
      component: { id: string; name: string }
      /** Component properties by their exact keys (`Title#29:17`, `tone`); an instance swap gets a component id. */
      properties: Record<string, string | boolean>
      /** The content of native slots, by the slot property's key (`Content#29:3`). */
      slots: Record<string, FigmaBuildNode[]>
      /** An image for the instance's fill: a URL or a path the bridge serves. */
      image?: string
    }
  | { kind: 'text'; path: string; characters: string; style?: string }

/** What a plugin builds: a frame named `name`, holding one node per section, named after the section key. */
export type FigmaBuildSpec = { version: 1; name: string; sections: { key: string; node: FigmaBuildNode }[] }

/** The spec, and what couldn't be expressed in Figma — by template path. */
export type FigmaBuildPlan = { ok: boolean; spec: FigmaBuildSpec; unmapped: Unmapped[] }

/** What `templateToFigma` needs from a mapping — `mapping(contract, …)` has it. */
export type ReversibleMapping = {
  contract: ContractDefinition
  keyFor: (figmaName: string) => string | undefined
  entryFor: (key: string) => { figma: string; props: Record<string, FigmaSource | undefined>; structure?: FigmaSlots } | undefined
  textComponent?: string
}

const normalize = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, '')
const baseName = (property: string) => property.replace(/#[^#]*$/, '')
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The library of a file (`GET /v1/files/:key`): every component set and standalone component, with its definitions. */
export function libraryFromFile(file: { document: FigmaNode }): FigmaLibraryComponent[] {
  const found: FigmaLibraryComponent[] = []
  const walk = (node: FigmaNode, inSet: boolean) => {
    if (node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && !inSet)) {
      const definitions = (node as FigmaNode & { componentPropertyDefinitions?: Record<string, FigmaPropertyDefinition> }).componentPropertyDefinitions ?? {}
      found.push({ id: node.id, name: node.name, type: node.type, definitions })
    }
    for (const child of node.children ?? []) walk(child, inSet || node.type === 'COMPONENT_SET')
  }
  walk(file.document, false)
  return found
}

/**
 * Templates → what a Figma plugin builds: every block an instance of the library component the mapping maps it from,
 * its props set on the component properties, its slots and children placed in native slots — the mapping applied in
 * reverse. What has no counterpart (a component with no library component, a prop with no property, a value not among
 * a variant's options) is reported by template path, not invented.
 */
export function templateToFigma(sections: Record<string, unknown>, options: { mapping: ReversibleMapping; library: FigmaLibraryComponent[]; name?: string }): FigmaBuildPlan {
  const { mapping, library } = options
  const unmapped: Unmapped[] = []
  const byKey = new Map<string, FigmaLibraryComponent>()
  for (const component of library) {
    const key = mapping.keyFor(component.name)
    if (key !== undefined && !byKey.has(key)) byKey.set(key, component)
  }
  const byName = (name: string) => library.find(component => component.name === name)

  const convert = (block: unknown, path: string): FigmaBuildNode | undefined => {
    if (!isObject(block) || typeof block.component !== 'string') {
      unmapped.push({ path, reason: 'not a block' })
      return undefined
    }
    const props = isObject(block.props) ? block.props : {}
    if (mapping.textComponent !== undefined && block.component === mapping.textComponent) {
      return { kind: 'text', path, characters: String(props.text ?? ''), ...(typeof props.style === 'string' && { style: props.style }) }
    }
    const component = byKey.get(block.component)
    if (!component) {
      unmapped.push({ path, reason: `no component of the Figma library maps to "${block.component}"` })
      return undefined
    }
    const definitions = Object.entries(component.definitions)
    const definition = (name: string, type?: string) => definitions.find(([key, def]) => normalize(baseName(key)) === normalize(name) && (type === undefined || def.type === type))
    const explicit = mapping.entryFor(block.component)
    const properties: Record<string, string | boolean> = {}
    let image: string | undefined

    for (const [prop, value] of Object.entries(props)) {
      const at = `${path}.props.${prop}`
      const reads = explicit?.props[prop]?.reads
      if (reads?.kind === 'image') {
        image = String(value)
        continue
      }
      if (reads?.kind === 'layer') {
        unmapped.push({ path: at, reason: `read from the text layer "${reads.name}" — not a component property, so it can't be set on an instance` })
        continue
      }
      const property = reads && 'property' in reads ? reads.property : prop
      const found = definition(property)
      if (!found) {
        unmapped.push({ path: at, reason: `"${component.name}" has no component property for "${prop}"` })
        continue
      }
      const [key, def] = found
      if (def.type === 'TEXT') properties[key] = String(value)
      else if (def.type === 'BOOLEAN') {
        const values = reads?.kind === 'boolean' ? reads.values : undefined
        properties[key] = values ? Object.keys(values).find(flag => values[flag] === value) === 'true' : Boolean(value)
      } else if (def.type === 'VARIANT') {
        const values = reads?.kind === 'variant' ? reads.values : undefined
        const option = values ? (Object.keys(values).find(figma => values[figma] === value) ?? String(value)) : String(value)
        if (def.variantOptions && !def.variantOptions.includes(option)) unmapped.push({ path: at, reason: `"${option}" is not an option of "${baseName(key)}" (${def.variantOptions.join(', ')})` })
        else properties[key] = option
      } else if (def.type === 'INSTANCE_SWAP') {
        const toValue = reads?.kind === 'swap' ? reads.toValue : (name: string) => name
        const target = library.find(candidate => toValue(candidate.name, { name: candidate.name } satisfies FigmaComponentRef) === value)
        if (target) properties[key] = target.id
        else unmapped.push({ path: at, reason: `no library component swaps in as "${String(value)}"` })
      } else unmapped.push({ path: at, reason: `"${baseName(key)}" is a ${def.type} property` })
    }

    // slots and children → native slots
    const slotDefs = definitions.filter(([, def]) => def.type === 'SLOT')
    const contractSlots = Object.keys((mapping.contract[block.component] as { slots?: Record<string, string> } | undefined)?.slots ?? {})
    const slots: Record<string, FigmaBuildNode[]> = {}
    const place = (slotKey: string, content: unknown, at: string) => {
      const items = Array.isArray(content) ? content : [content]
      items.forEach((item, i) => {
        const node = convert(item, Array.isArray(content) ? `${at}[${i}]` : at)
        if (node) (slots[slotKey] ??= []).push(node)
      })
    }
    for (const [slot, content] of Object.entries(isObject(block.slots) ? block.slots : {})) {
      const figmaName = explicit?.structure?.slots?.[slot] ?? slot
      const found = slotDefs.find(([key]) => normalize(baseName(key)) === normalize(figmaName))
      if (found) place(found[0], content, `${path}.slots.${slot}`)
      else unmapped.push({ path: `${path}.slots.${slot}`, reason: `"${component.name}" has no native slot for "${slot}"` })
    }
    if (Array.isArray(block.children) && block.children.length) {
      const named = explicit?.structure?.children
      const candidates = named
        ? slotDefs.filter(([key]) => [named].flat().some(name => normalize(name) === normalize(baseName(key))))
        : slotDefs.filter(([key]) => !contractSlots.some(slot => normalize(slot) === normalize(baseName(key))))
      if (candidates.length) block.children.forEach((child, i) => place(candidates[0]![0], child, `${path}.children[${i}]`))
      else unmapped.push({ path: `${path}.children`, reason: `"${component.name}" has no native slot for its children` })
    }
    return { kind: 'instance', path, component: { id: component.id, name: component.name }, properties, slots, ...(image !== undefined && { image }) }
  }

  const built: FigmaBuildSpec['sections'] = []
  for (const [key, block] of Object.entries(sections)) {
    const node = convert(block, key)
    if (node) built.push({ key, node })
  }
  return { ok: unmapped.length === 0, spec: { version: 1, name: options.name ?? 'Dedal page', sections: built }, unmapped }
}
