# 002 — The contract at runtime

- **Status:** accepted
- **Date:** 2026-10-31

## Context

Dedal's positioning ([000](000-positioning.md)) is pages generated from Figma or assembled in a page builder. Both produce **JSON templates** — and until 0.6 a JSON template was a second-class path:

- the contract was a TypeScript type only, so nothing checked a template from storage; an unknown component or a wrong prop showed up as an empty spot on the page,
- `defaults` were added by `node()`, so a template parsed from JSON didn't get them,
- `sections` was synchronous, so a template from async storage forced the app to create the page per request.

A page builder also needs to know, at runtime, which components exist and what props they take — to draw its property panels.

## Decision

**1. The contract can be a value.** `defineContract({ card: { props: schema, slots: { badge: 'one' } } })`, with the type inferred from it (`InferContract`). One source of truth for the compiler and for runtime checks. A contract written as a type stays fully supported, for projects without templates from outside the code.

**2. Schemas through the Standard Schema interface**, not a specific library. The interface is copied into the core (as the spec intends), so the core keeps zero dependencies; zod, valibot, arktype and others work. The props type is the schema's **output** type.

**3. Validation with paths.** `ui.validate` / `ui.validateSections` / `validateTemplate` collect every problem in tree order, each with its path (`news.children[2].slots.badge`): unknown components and slots (with a suggestion), the slot kind, props against their schema, `repeat`, `alias`, unknown fields. **Props missing from a template are not an error** — data fills them at `resolve`; props that are present must match the schema.

**4. `defaults` are applied in `layout()`**, under every node's props, instead of in `node()`. A block from code and one from JSON behave the same, and a block saved as JSON doesn't carry the defaults of the day it was created. `trace` now knows exactly which props came from the defaults.

**5. `sections` may be async.** A page reads its templates inside its own definition; `page.layout()` and `page.assign()` return Promises.

**6. JSON Schema export.** `ui.jsonSchema()` gives a template block schema (props partial, like validation) and the full props schema of each component. Props schemas come from Standard JSON Schema where a library implements it (zod 4) or from a converter the app passes (valibot).

**7. Debug builds check templates** against the contract and report problems in devtools — reported, not thrown, so the page still renders next to its cause.

## Alternatives

- **Types only, validation left to the app** (0.6). Every project wrote the same validator by hand, without schemas for props, and a page builder had nothing to read at runtime.
- **Depend on one schema library (zod).** Simpler to implement, but forces a dependency and a library choice on every user.
- **Dedal's own schema language.** Full control over JSON Schema export, but one more thing to learn and maintain, when Standard Schema already exists.
- **Validate the final props in `resolve`.** Would catch data that leaves a required prop empty, but costs a schema run per node on every request; the check belongs where templates enter the system (save, load, CI, debug builds).
- **Schema defaults (`.default('md')`) instead of `defaults`.** Would need validation of every node's props at build time to apply them; `defaults` in `layout()` cost a merge, measured at ~1.5% of layout time.

## Consequences

- **Breaking changes (0.7.0):** `node()` no longer adds `defaults` to the block it returns; `page.layout()` and `page.assign()` are async; `createDedal` takes the contract as a value or a type argument (`createDedal<Contract>()` and `ReturnType<typeof createDedal<Contract>>` keep working).
- Core size 8.3 → 9.9 KB min + gzip (validation and JSON Schema export are always included); benchmarks unchanged within noise.
- The docs lead with the contract as a value where templates come from outside the code (the tutorial, the storage and Figma guides); the Quick start keeps the type for the simplest start.
- A page builder example (the roadmap's next step) builds its property panels from `ui.jsonSchema().props`.
- Not covered: whether data supplies every required prop at `resolve` — the final props aren't validated (see *Limitations*).
