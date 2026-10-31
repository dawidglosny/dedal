import type { ContractDefinition, StandardSchema } from './contract'

/** One problem in a template: where (`news.children[2].slots.badge`) and what. */
export type ValidationError = { path: string; message: string }

/** The result of validating a template: the template typed by the contract, or the errors. */
export type ValidationResult<T> = { ok: true; value: T; errors: [] } | { ok: false; errors: ValidationError[] }

const BLOCK_FIELDS = ['component', 'props', 'slots', 'children', 'alias', 'repeat']

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const describeValue = (value: unknown) =>
  Array.isArray(value)
    ? `an array (${value.length} items)`
    : value === null
      ? 'null'
      : typeof value === 'object'
        ? 'an object'
        : `${typeof value} ${JSON.stringify(value)}`

/** Edit distance, for "did you mean" on component and slot names. */
const distance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

const suggestion = (name: string, candidates: string[]) => {
  const [best] = candidates
    .map(candidate => ({ candidate, score: distance(name.toLowerCase(), candidate.toLowerCase()) }))
    .filter(({ score }) => score <= Math.max(1, Math.floor(name.length / 3)))
    .sort((a, b) => a.score - b.score)
  return best ? ` — did you mean "${best.candidate}"?` : ''
}

type Issue = NonNullable<Awaited<ReturnType<StandardSchema['~standard']['validate']>>['issues']>[number]
type IssueSegment = NonNullable<Issue['path']>[number]

const keyOf = (segment: IssueSegment) => (typeof segment === 'object' && segment !== null ? segment.key : segment)
const pathOf = (path: readonly IssueSegment[]) =>
  path.map(keyOf).map(key => (typeof key === 'number' ? `[${key}]` : `.${String(key)}`)).join('')

/**
 * Props in a template are partial — the rest comes from data at `resolve` — so a prop missing from the template is
 * not an error. A prop that is there must match the schema: issues about keys absent from the template are dropped.
 */
async function checkProps(schema: StandardSchema, props: Record<string, unknown>, path: string): Promise<ValidationError[]> {
  const result = await schema['~standard'].validate(props)
  if (!result.issues) return []
  return result.issues
    .filter(issue => {
      const first = issue.path?.[0]
      return first === undefined || Object.hasOwn(props, keyOf(first) as string)
    })
    .map(issue => ({ path: `${path}${pathOf(issue.path ?? [])}`, message: issue.message }))
}

/**
 * Validates a template block against a contract definition: the block's shape, known components and slots, the slot
 * kind (one node or a list), props against the component's schema, `repeat` and `alias`. All errors are collected,
 * in tree order, each with its path.
 */
export async function validateTemplate(contract: ContractDefinition, value: unknown, path = 'template'): Promise<ValidationError[]> {
  const parts: (ValidationError | Promise<ValidationError[]>)[] = []
  const error = (at: string, message: string) => parts.push({ path: at, message })
  const components = Object.keys(contract)

  const visit = (block: unknown, at: string) => {
    if (!isObject(block)) return error(at, `expected a block (an object with "component"), got ${describeValue(block)}`)

    for (const field of Object.keys(block)) {
      if (!BLOCK_FIELDS.includes(field)) error(`${at}.${field}`, `unknown field "${field}" — a block has ${BLOCK_FIELDS.join(', ')}`)
    }

    const { component, props, slots, children, alias, repeat } = block
    if (typeof component !== 'string') return error(`${at}.component`, `expected a component name, got ${describeValue(component)}`)
    const definition = Object.hasOwn(contract, component) ? contract[component] : undefined
    if (!definition) error(`${at}.component`, `unknown component "${component}"${suggestion(component, components)}`)

    if (alias !== undefined && typeof alias !== 'string') error(`${at}.alias`, `expected a string, got ${describeValue(alias)}`)
    if (repeat !== undefined && !(typeof repeat === 'number' && Number.isInteger(repeat) && repeat >= 1)) {
      error(`${at}.repeat`, `expected an integer >= 1, got ${describeValue(repeat)}`)
    }

    if (props !== undefined) {
      if (!isObject(props)) error(`${at}.props`, `expected an object, got ${describeValue(props)}`)
      else if (definition?.props) parts.push(checkProps(definition.props, props, `${at}.props`))
      else if (definition && Object.keys(props).length) error(`${at}.props`, `"${component}" has no props in the contract`)
    }

    if (slots !== undefined) {
      if (!isObject(slots)) error(`${at}.slots`, `expected an object, got ${describeValue(slots)}`)
      else {
        const declared = definition?.slots ?? {}
        for (const [name, content] of Object.entries(slots)) {
          const slotPath = `${at}.slots.${name}`
          const kind = Object.hasOwn(declared, name) ? declared[name] : undefined
          if (definition && !kind) {
            error(slotPath, `"${component}" has no slot "${name}"${suggestion(name, Object.keys(declared))}`)
            continue
          }
          if (kind === 'many' && !Array.isArray(content)) error(slotPath, `expected a list of blocks (the slot is "many"), got ${describeValue(content)}`)
          else if (kind === 'one' && Array.isArray(content)) error(slotPath, `expected one block (the slot is "one"), got ${describeValue(content)}`)
          else if (Array.isArray(content)) content.forEach((child, i) => visit(child, `${slotPath}[${i}]`))
          else visit(content, slotPath)
        }
      }
    }

    if (children !== undefined) {
      if (!Array.isArray(children)) error(`${at}.children`, `expected an array, got ${describeValue(children)}`)
      else children.forEach((child, i) => visit(child, `${at}.children[${i}]`))
    }
  }

  visit(value, path)
  return (await Promise.all(parts)).flat()
}
