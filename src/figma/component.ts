import type { ContractDefinition } from '../contract'
import { contractToJsonSchema } from '../json-schema'
import type { FigmaNodeEntry } from './index'

/** A component property definition, as the REST API returns it on a component or a component set. */
export type FigmaPropertyDefinition = {
  type: string
  defaultValue?: unknown
  variantOptions?: string[]
  preferredValues?: unknown[]
}

/** One prop of a proposed contract entry, and where it comes from in Figma. */
export type ProposedProp = {
  prop: string
  /** The Figma property it's read from (`Label#3:0`). */
  figma: string
  type: 'string' | 'enum' | 'boolean'
  /** VARIANT: the allowed values. */
  values?: string[]
  default?: unknown
  optional: boolean
  source: 'text' | 'variant' | 'boolean' | 'swap'
}

export type ProposedSlot = { slot: string; figma: string; kind: 'one' | 'many' }

/** How the Figma component differs from the contract entry it already has. */
export type ContractDrift = {
  /** The contract component it was matched to. */
  key: string
  missingProps: string[]
  /** Variant values the design has and the contract doesn't: prop → values. */
  missingValues: Record<string, string[]>
  missingSlots: string[]
  /** Props the contract has and the design doesn't — maybe filled by data, maybe stale. */
  extraProps: string[]
}

/** A contract entry proposed for a Figma component — to review, answer the questions, and add. */
export type ComponentProposal = {
  /** The Figma component (or component set) name. */
  figmaName: string
  /** The contract key: the Figma name in camelCase (after the `componentName` rule). */
  key: string
  props: ProposedProp[]
  slots: ProposedSlot[]
  /** The contract entry, as code (zod) — for `defineContract({ … })`. */
  code: string
  /** A registry entry to start from: the props destructured, the slots as props. */
  registryStub: string
  /** The mapping entry, when the convention doesn't find the component or a value needs a transform. */
  mappingEntry?: string
  /** What the proposal couldn't know — to ask the user before adding it. */
  questions: string[]
  /** When the contract already has this component: how it differs. */
  drift?: ContractDrift
}

const baseName = (property: string) => property.replace(/#[^#]*$/, '')
const normalize = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, '')
/** `Icon right` → `iconRight`, `FeatureCard` → `featureCard`, `section-heading` → `sectionHeading`. */
const camel = (name: string) =>
  name
    .trim()
    .replace(/[^\p{L}\p{N}]+(.)?/gu, (_, char: string | undefined) => (char ? char.toUpperCase() : ''))
    .replace(/^./, char => char.toLowerCase())
const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/**
 * A Figma component or component set (a `GET /v1/files/:key/nodes` entry for its node) → a proposed contract entry:
 * `TEXT` → a string, `VARIANT` → an enum of its options, `BOOLEAN` → a boolean, `INSTANCE_SWAP` → the swapped
 * component's name, `SLOT` → a slot. With `contract`, also how it differs from the entry the contract already has.
 */
export function contractFromFigma(
  entry: FigmaNodeEntry,
  options: {
    componentName?: (name: string) => string
    contract?: ContractDefinition
    /** A mapping: its contract, its `componentName` rule, and how it finds the component (explicit entries included). */
    mapping?: { contract: ContractDefinition; keyFor: (figmaName: string) => string | undefined; componentName?: (name: string) => string }
  } = {}
): ComponentProposal {
  const componentName = options.componentName ?? options.mapping?.componentName
  const contract = options.contract ?? options.mapping?.contract
  const node = entry.document as typeof entry.document & { componentPropertyDefinitions?: Record<string, FigmaPropertyDefinition> }
  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') {
    throw new Error(`figma: "${node.name}" is a ${node.type}, not a component or a component set — point at the main component (or pass an instance to the CLI / MCP tool, which resolves it)`)
  }
  if (node.type === 'COMPONENT' && entry.components[node.id]?.componentSetId) {
    throw new Error(`figma: "${node.name}" is a variant of a component set — point at the set`)
  }
  const figmaName = node.name
  const mappedKey = options.mapping?.keyFor(figmaName)
  const key = mappedKey ?? camel(componentName ? componentName(figmaName) : figmaName)
  const definitions = Object.entries(node.componentPropertyDefinitions ?? {})
  const props: ProposedProp[] = []
  const slots: ProposedSlot[] = []
  const questions: string[] = []
  const swaps: string[] = []

  for (const [figma, definition] of definitions) {
    const prop = camel(baseName(figma))
    if (definition.type === 'TEXT') props.push({ prop, figma, type: 'string', default: definition.defaultValue, optional: false, source: 'text' })
    else if (definition.type === 'BOOLEAN') props.push({ prop, figma, type: 'boolean', default: definition.defaultValue, optional: true, source: 'boolean' })
    else if (definition.type === 'VARIANT') props.push({ prop, figma, type: 'enum', values: definition.variantOptions ?? [], default: definition.defaultValue, optional: true, source: 'variant' })
    else if (definition.type === 'INSTANCE_SWAP') {
      const id = typeof definition.defaultValue === 'string' ? definition.defaultValue : undefined
      const meta = id ? entry.components[id] : undefined
      const example = meta ? (meta.componentSetId ? entry.componentSets[meta.componentSetId]?.name : meta.name) : undefined
      props.push({ prop, figma, type: 'string', default: example, optional: true, source: 'swap' })
      swaps.push(prop)
      questions.push(
        `"${prop}" is an instance swap: the template gets the swapped component's name${example ? ` (e.g. "${example}")` : ''}. Keep the full name, or map it to a shorter value (swap('${baseName(figma)}', name => …))?`
      )
    } else if (definition.type === 'SLOT') {
      slots.push({ slot: camel(baseName(figma)), figma, kind: 'many' })
    }
  }

  const texts = props.filter(prop => prop.source === 'text').map(prop => prop.prop)
  if (texts.length) questions.push(`Which texts are required? Proposed as required: ${texts.join(', ')} — make a text optional if a page may leave it out or data fills it.`)
  for (const slot of slots) questions.push(`Slot "${slot.slot}": one block or a list? Proposed: a list ('many').`)
  const suffix = /\s*\(([^)]+)\)\s*$/.exec(figmaName)
  if (suffix && !componentName && !mappedKey)
    questions.push(`"${figmaName}" ends with "(${suffix[1]})" — a library suffix? Then a componentName rule (name => name.replace(/ \\(${suffix[1]}\\)$/, '')) for the whole library, and the key "${camel(figmaName.slice(0, suffix.index))}".`)
  if (!definitions.length) questions.push(`"${figmaName}" has no component properties — a component with fixed content (a logo, a divider), or are its texts and states missing as properties in Figma?`)

  const propCode = (prop: ProposedProp) => {
    const schema =
      prop.type === 'enum' ? `z.enum([${(prop.values ?? []).map(quote).join(', ')}])` : prop.type === 'boolean' ? 'z.boolean()' : 'z.string()'
    const note = prop.source === 'swap' ? ' // instance swap: the swapped component\'s name' : ''
    return `    ${prop.prop}: ${schema}${prop.optional ? '.optional()' : ''},${note}`
  }
  const parts: string[] = []
  if (props.length) parts.push(`  props: z.object({\n${props.map(propCode).join('\n')}\n  }),`)
  if (slots.length) parts.push(`  slots: { ${slots.map(slot => `${slot.slot}: '${slot.kind}'`).join(', ')} },`)
  const code = parts.length ? `${key}: {\n${parts.join('\n')}\n},` : `${key}: {},`

  const params = [...props.map(prop => prop.prop), ...slots.map(slot => slot.slot)]
  const registryStub = `${key}: (${params.length ? `{ ${params.join(', ')} }` : ''}) => (\n  <div>{/* ${figmaName} */}</div>\n),`

  // the convention finds the component when its normalized name equals the key's; a swap may want a transform
  const found = mappedKey !== undefined || normalize(componentName ? componentName(figmaName) : figmaName) === normalize(key)
  const swapSources = swaps.map(prop => `${prop}: swap(${quote(baseName(props.find(p => p.prop === prop)!.figma))}, name => name)`)
  const mappingEntry = (!found || swapSources.length) && !mappedKey ? `${key}: component(${quote(figmaName)}${swapSources.length ? `, { ${swapSources.join(', ')} }` : ''}),` : undefined

  return { figmaName, key, props, slots, code, registryStub, ...(mappingEntry && { mappingEntry }), questions, ...(contract && { drift: driftOf(contract, key, props, slots) }) }
}

function driftOf(contract: ContractDefinition, key: string, props: ProposedProp[], slots: ProposedSlot[]): ContractDrift | undefined {
  const existing = Object.keys(contract).find(name => normalize(name) === normalize(key))
  if (existing === undefined) return undefined
  const schema = contractToJsonSchema(contract).props[existing] as { properties?: Record<string, { enum?: unknown[] }> } | undefined
  const known = schema?.properties ?? {}
  const knownNames = new Map(Object.keys(known).map(name => [normalize(name), name]))
  const missingProps: string[] = []
  const missingValues: Record<string, string[]> = {}
  for (const prop of props) {
    const name = knownNames.get(normalize(prop.prop))
    if (name === undefined) missingProps.push(prop.prop)
    else if (prop.values && Array.isArray(known[name]!.enum)) {
      const allowed = new Set(known[name]!.enum!.map(String))
      const missing = prop.values.filter(value => !allowed.has(value))
      if (missing.length) missingValues[name] = missing
    }
  }
  const contractSlots = (contract[existing] as { slots?: Record<string, string> }).slots ?? {}
  const missingSlots = slots.map(slot => slot.slot).filter(slot => !Object.keys(contractSlots).some(name => normalize(name) === normalize(slot)))
  const designNames = new Set(props.map(prop => normalize(prop.prop)))
  const extraProps = Object.keys(known).filter(name => !designNames.has(normalize(name)))
  return { key: existing, missingProps, missingValues, missingSlots, extraProps }
}
