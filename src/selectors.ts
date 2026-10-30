/**
 * CSS-syntax selectors, matched against the layout tree.
 *
 * Supported:
 * - `card`, `*`                      — component / any
 * - `#main`                          — alias
 * - `[size]`, `[size=small]`, `[style.height="100%"]` — prop exists / has a value (compared as a string)
 * - `:first-child`, `:last-child`, `:nth-child(2)`, `:nth-child(odd)`, `:nth-child(3n+1)`, `:nth-last-child(...)`
 * - `:slot`, `:slot(media)` — node in any / a specific parent slot
 * - `:root` — tree root (as in CSS)
 * - `a b` (descendant, also through slots), `a > b` (child or slot content), `a, b` (list)
 *
 * `:nth-child` indices are 1-based, as in CSS, after expanding `repeat`; in a list slot — within the slot.
 */

type Nth = { a: number; b: number; fromEnd: boolean }

type Attribute = { path: string[]; value?: string }

/** Slot requirement: a specific name or `null` = any slot. */
type SlotRequirement = string | null

/** A parsed compound selector: component, aliases, attributes, positions and slots of one node (`card#lead[size=lg]:first-child`). */
export type CompoundSelector = {
  component?: string
  aliases: string[]
  attributes: Attribute[]
  nth: Nth[]
  slots: SlotRequirement[]
  /** `:root` — only the tree root. */
  root?: true
}

type Combinator = ' ' | '>'

/** Complex selector, e.g. `grid > card:first-child`. `combinators[i]` joins `compounds[i]` with `compounds[i + 1]`. */
export type ComplexSelector = {
  compounds: CompoundSelector[]
  combinators: Combinator[]
}

/** A parsed selector list (`a, b`) — what `parseSelector()` returns. */
export type SelectorList = ComplexSelector[]

/** Node as seen by the matcher: only what is needed for matching. */
export type MatchNode = {
  component: string
  alias?: string
  props?: Record<string, unknown>
}

/** Entry of the path from the root to the matched node. */
export type PathEntry = {
  node: MatchNode
  /** Index among siblings (0-based). */
  index: number
  /** Number of siblings including the node (in a list slot — number of slot items). */
  count: number
  /** Name of the parent's slot the node sits in (absent = regular child or root). */
  slot?: string
}

const IDENT_CHAR = /[A-Za-z0-9_-]/

class SelectorParser {
  private pos = 0

  constructor(private readonly src: string) {}

  parse(): SelectorList {
    const list: SelectorList = [this.complex()]

    while (this.peek() === ',') {
      this.pos++
      list.push(this.complex())
    }

    this.skipSpaces()
    if (this.pos < this.src.length) this.fail(`unexpected character "${this.peek()}"`)

    return list
  }

  private complex(): ComplexSelector {
    this.skipSpaces()
    const compounds = [this.compound()]
    const combinators: Combinator[] = []

    for (;;) {
      const hadSpace = this.skipSpaces()
      const next = this.peek()

      if (next === '>') {
        this.pos++
        this.skipSpaces()
        combinators.push('>')
      } else if (hadSpace && next !== undefined && next !== ',') {
        combinators.push(' ')
      } else {
        break
      }

      compounds.push(this.compound())
    }

    return { compounds, combinators }
  }

  private compound(): CompoundSelector {
    const compound: CompoundSelector = { aliases: [], attributes: [], nth: [], slots: [] }
    const start = this.pos

    if (this.peek() === '*') {
      this.pos++
    } else if (this.isIdentChar(this.peek())) {
      compound.component = this.ident()
    }

    for (;;) {
      const next = this.peek()

      if (next === '#') {
        this.pos++
        compound.aliases.push(this.ident())
      } else if (next === '[') {
        compound.attributes.push(this.attribute())
      } else if (next === ':') {
        const pseudo = this.pseudo()
        if ('root' in pseudo) compound.root = true
        else if ('slot' in pseudo) compound.slots.push(pseudo.slot)
        else compound.nth.push(pseudo)
      } else {
        break
      }
    }

    if (this.pos === start) this.fail('expected a selector')

    return compound
  }

  private attribute(): Attribute {
    this.pos++ // [
    this.skipSpaces()
    const path = [this.ident()]

    while (this.peek() === '.') {
      this.pos++
      path.push(this.ident())
    }

    this.skipSpaces()
    let value: string | undefined

    if (this.peek() === '=') {
      this.pos++
      this.skipSpaces()
      value = this.value()
      this.skipSpaces()
    }

    this.expect(']')

    return { path, value }
  }

  private value(): string {
    const quote = this.peek()

    if (quote === '"' || quote === "'") {
      const end = this.src.indexOf(quote, this.pos + 1)
      if (end === -1) this.fail('unterminated quote')
      const value = this.src.slice(this.pos + 1, end)
      this.pos = end + 1
      return value
    }

    const start = this.pos
    while (this.pos < this.src.length && !/[\]\s]/.test(this.src[this.pos])) this.pos++
    if (this.pos === start) this.fail('expected a value')

    return this.src.slice(start, this.pos)
  }

  private pseudo(): Nth | { slot: SlotRequirement } | { root: true } {
    this.pos++ // :
    const name = this.ident()

    switch (name) {
      case 'slot': {
        if (this.peek() !== '(') return { slot: null }
        this.pos++
        this.skipSpaces()
        const slot = this.ident()
        this.skipSpaces()
        this.expect(')')
        return { slot }
      }
      case 'root':
        return { root: true }
      case 'first-child':
        return { a: 0, b: 1, fromEnd: false }
      case 'last-child':
        return { a: 0, b: 1, fromEnd: true }
      case 'nth-child':
      case 'nth-last-child': {
        this.expect('(')
        const end = this.src.indexOf(')', this.pos)
        if (end === -1) this.fail('unterminated parenthesis')
        const nth = parseNth(this.src.slice(this.pos, end))
        if (!nth) this.fail(`invalid expression in :${name}()`)
        this.pos = end + 1
        return { ...nth, fromEnd: name === 'nth-last-child' }
      }
      default:
        return this.fail(`unsupported pseudo-class ":${name}"`)
    }
  }

  private ident(): string {
    const start = this.pos
    while (this.isIdentChar(this.peek())) this.pos++
    if (this.pos === start) this.fail('expected a name')

    return this.src.slice(start, this.pos)
  }

  private skipSpaces(): boolean {
    const start = this.pos
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++

    return this.pos > start
  }

  private expect(char: string) {
    if (this.peek() !== char) this.fail(`expected "${char}"`)
    this.pos++
  }

  private peek(): string | undefined {
    return this.src[this.pos]
  }

  private isIdentChar(char: string | undefined): boolean {
    return char !== undefined && IDENT_CHAR.test(char)
  }

  private fail(message: string): never {
    throw new SyntaxError(`Selector "${this.src}", position ${this.pos}: ${message}`)
  }
}

/** Parses `an+b`, `odd`, `even`, `n`, `3`. */
function parseNth(raw: string): { a: number; b: number } | null {
  const expr = raw.replace(/\s+/g, '')

  if (expr === 'odd') return { a: 2, b: 1 }
  if (expr === 'even') return { a: 2, b: 0 }
  if (/^[+-]?\d+$/.test(expr)) return { a: 0, b: Number(expr) }

  const match = expr.match(/^([+-]?\d*)n([+-]\d+)?$/)
  if (!match) return null

  const [, coefficient, offset] = match
  const a = coefficient === '' || coefficient === '+' ? 1 : coefficient === '-' ? -1 : Number(coefficient)

  return { a, b: offset ? Number(offset) : 0 }
}

/** Cache limit — selectors built from data (`[slug=${slug}]`) must not grow the process without bound. */
const CACHE_LIMIT = 1000

/** LRU cache: `Map` preserves insertion order, so the first key is the least recently used selector. */
const cache = new Map<string, SelectorList>()

/** Parses a selector (the result is cached). Throws `SyntaxError` for invalid syntax. */
export function parseSelector(selector: string): SelectorList {
  let parsed = cache.get(selector)

  if (parsed) {
    cache.delete(selector)
  } else {
    parsed = new SelectorParser(selector).parse()
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  }

  cache.set(selector, parsed)

  return parsed
}

const matchesNth = ({ a, b, fromEnd }: Nth, { index, count }: PathEntry) => {
  const position = fromEnd ? count - index : index + 1

  if (a === 0) return position === b

  const n = (position - b) / a
  return Number.isInteger(n) && n >= 0
}

const readPath = (props: Record<string, unknown> | undefined, path: string[]): unknown =>
  path.reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], props)

const matchesCompound = (compound: CompoundSelector, entry: PathEntry, isRoot: boolean): boolean => {
  if (compound.root && !isRoot) return false

  const { node } = entry

  if (compound.component !== undefined && compound.component !== node.component) return false
  if (compound.aliases.some(alias => alias !== node.alias)) return false

  for (const { path, value } of compound.attributes) {
    const actual = readPath(node.props, path)
    if (actual === undefined) return false
    if (value !== undefined && String(actual) !== value) return false
  }

  for (const slot of compound.slots) {
    if (entry.slot === undefined || (slot !== null && entry.slot !== slot)) return false
  }

  return compound.nth.every(nth => matchesNth(nth, entry))
}

/** Right-to-left matching, as in the browser: the last compound against the node, the rest against ancestors. */
const matchesComplex = ({ compounds, combinators }: ComplexSelector, path: readonly PathEntry[]): boolean => {
  const matchAt = (compoundIndex: number, pathIndex: number): boolean => {
    if (!matchesCompound(compounds[compoundIndex], path[pathIndex], pathIndex === 0)) return false
    if (compoundIndex === 0) return true

    if (combinators[compoundIndex - 1] === '>') {
      return pathIndex > 0 && matchAt(compoundIndex - 1, pathIndex - 1)
    }

    for (let ancestor = pathIndex - 1; ancestor >= 0; ancestor--) {
      if (matchAt(compoundIndex - 1, ancestor)) return true
    }

    return false
  }

  return path.length > 0 && matchAt(compounds.length - 1, path.length - 1)
}

/** Whether the last node of the path matches the selector. */
export function matches(selector: string | SelectorList, path: readonly PathEntry[]): boolean {
  const list = typeof selector === 'string' ? parseSelector(selector) : selector

  return list.some(complex => matchesComplex(complex, path))
}
