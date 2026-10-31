import type { ContractDefinition, StandardSchema } from './contract'

/** A JSON Schema document (draft 2020-12), as plain JSON. */
export type JsonSchema = { [key: string]: unknown }

export type ContractJsonSchemaOptions = {
  /**
   * Turns a props schema into JSON Schema, for libraries that don't implement Standard JSON Schema
   * (e.g. valibot: `schema => toJsonSchema(schema)` from `@valibot/to-json-schema`). Libraries that do (zod 4) need nothing.
   */
  propsToJsonSchema?: (schema: StandardSchema, component: string) => JsonSchema
}

/** The contract as JSON Schema: a template, and the props of every component. */
export type ContractJsonSchema = {
  /**
   * A template block — components, slots (one node or a list), children, alias, repeat. Props are partial, as in
   * `ui.validate`: a template may leave props to the data. For validating templates outside JavaScript
   * (a CMS, a backend in another language, an editor).
   */
  template: JsonSchema
  /** The full props schema of every component (with its required props) — e.g. for a page builder's property panel. */
  props: Record<string, JsonSchema>
  /** Components whose props schema couldn't be turned into JSON Schema — their props are left open (`{}`). */
  unconverted: string[]
}

/** Standard JSON Schema (https://standardschema.dev): `~standard.jsonSchema.input({ target })`, implemented by zod 4. */
type WithJsonSchema = { '~standard': { jsonSchema?: { input?: (options: { target: string }) => JsonSchema } } }

const DRAFT = 'https://json-schema.org/draft/2020-12/schema'

const propsJsonSchema = (schema: StandardSchema, component: string, options: ContractJsonSchemaOptions): JsonSchema | undefined => {
  const standard = (schema as unknown as WithJsonSchema)['~standard'].jsonSchema
  const converted = standard?.input
    ? standard.input({ target: 'draft-2020-12' })
    : options.propsToJsonSchema?.(schema, component)
  if (!converted) return undefined
  const { $schema: _, ...rest } = converted
  return rest
}

/** Props in a template are partial — data fills the rest at `resolve`. */
const partial = (schema: JsonSchema): JsonSchema => {
  const { required: _, ...rest } = schema
  return rest
}

/**
 * The contract as JSON Schema (draft 2020-12): a schema of a template block, and the props schema of every component.
 * Props schemas come from the Standard JSON Schema interface (zod 4) or from `propsToJsonSchema` (other libraries).
 *
 * @example
 * ```ts
 * const { template, props } = contractToJsonSchema(contract)
 * // template — validate stored templates in any language; props.card — a property panel for "card"
 * ```
 */
export function contractToJsonSchema(contract: ContractDefinition, options: ContractJsonSchemaOptions = {}): ContractJsonSchema {
  const props: Record<string, JsonSchema> = {}
  const unconverted: string[] = []
  const $defs: Record<string, JsonSchema> = {}
  const block = { $ref: '#/$defs/block' }

  for (const [component, definition] of Object.entries(contract)) {
    let componentProps: JsonSchema = { type: 'object', additionalProperties: false, properties: {} }
    if (definition.props) {
      const converted = propsJsonSchema(definition.props, component, options)
      if (converted) componentProps = converted
      else {
        componentProps = {}
        unconverted.push(component)
      }
    }
    props[component] = componentProps

    const slots = Object.entries(definition.slots ?? {})
    $defs[component] = {
      type: 'object',
      properties: {
        component: { const: component },
        props: partial(componentProps),
        ...(slots.length && {
          slots: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(slots.map(([name, kind]) => [name, kind === 'many' ? { type: 'array', items: block } : block])),
          },
        }),
        children: { type: 'array', items: block },
        alias: { type: 'string' },
        repeat: { type: 'integer', minimum: 1 },
      },
      required: ['component'],
      additionalProperties: false,
    }
  }

  $defs.block = { oneOf: Object.keys(contract).map(component => ({ $ref: `#/$defs/${component}` })) }

  return { template: { $schema: DRAFT, $ref: '#/$defs/block', $defs }, props, unconverted }
}
