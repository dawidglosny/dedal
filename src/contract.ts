import type { Slot } from './types'

/**
 * The Standard Schema interface (https://standardschema.dev) — implemented by zod, valibot, arktype and others.
 * Copied here, as the spec intends, so the core has no dependency: any library that implements it works.
 */
export type StandardSchema<Input = unknown, Output = Input> = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

/** The result of `validate` in the Standard Schema interface: the value, or the issues. */
export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> }> }

/** A slot in the contract: one node (`'one'`) or a list of nodes (`'many'`). */
export type SlotKind = 'one' | 'many'

/** One component in a contract definition: a schema for its props and its slots. */
export type ComponentDefinition = {
  /** A Standard Schema of the props (an object schema); without it the component has no props. */
  readonly props?: StandardSchema
  /** Slot name → `'one'` or `'many'`. */
  readonly slots?: Readonly<Record<string, SlotKind>>
}

/** A contract as a value: component name → its definition. */
export type ContractDefinition = Readonly<Record<string, ComponentDefinition>>

type Simplify<T> = { [K in keyof T]: T[K] } & {}

/** The props type of a schema: its output type. A component without a schema has no props. */
type PropsFrom<D extends ComponentDefinition> = D['props'] extends StandardSchema<unknown, infer Output>
  ? Output extends object
    ? Output
    : never
  : Record<never, never>

type SlotsFrom<D extends ComponentDefinition> = D['slots'] extends Readonly<Record<string, SlotKind>>
  ? { -readonly [K in keyof D['slots']]?: D['slots'][K] extends 'many' ? Slot[] : Slot }
  : Record<never, never>

/**
 * The contract type inferred from a contract definition — the same shape as a contract written as a type:
 * component name → props, with slots marked as `Slot` / `Slot[]`.
 *
 * @example
 * ```ts
 * const contract = defineContract({ card: { props: z.object({ title: z.string() }), slots: { badge: 'one' } } })
 * type Contract = InferContract<typeof contract> // { card: { title: string; badge?: Slot } }
 * ```
 */
export type InferContract<D extends ContractDefinition> = { -readonly [N in keyof D]: Simplify<PropsFrom<D[N]> & SlotsFrom<D[N]>> }

/**
 * Defines the contract as a value: a props schema (any Standard Schema library) and the slots of every component.
 * One source of truth — the type is inferred from it (`InferContract`), and templates from outside the code can be
 * validated against it at runtime.
 */
export function defineContract<const D extends ContractDefinition>(definition: D): D {
  return definition
}
