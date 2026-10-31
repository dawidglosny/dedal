---
name: figma-to-dedal
description: Turn a Figma frame into Dedal templates checked against the project's contract — pull the frame, read the report, fix what didn't map (in the mapping, in Figma, or as a contract change the user approves), save the templates. Use when the user shares a Figma link and wants a page, a section or a template from it in a project that uses Dedal (a `dedal` dependency, a mapping module with `mapping(contract, …)` from `dedal/figma`), or asks why a Figma frame doesn't convert.
---

# Figma frame → Dedal templates

Dedal renders pages from templates (JSON) with the project's own components. `dedal/figma` converts a Figma frame into those templates through a **mapping** (Figma components, properties and slots → contract components, props and slots), and validates the result against the **contract**. This skill runs that conversion, reads its report and gets the frame to a clean template — without guessing and without silently changing the contract.

## What you need

- **The frame:** a Figma URL with `?node-id=…` (or a file key and a node id). Every top-level layer of the frame becomes a section.
- **The mapping module:** usually `figma.mapping.mjs` / `figma.mapping.js` — its default export is `mapping(contract, { … }, options)`. Find it with a search for `from 'dedal/figma'`. If the project has none, see *A new mapping* below.
- **`FIGMA_TOKEN`** in the environment: a Figma personal access token with file content read access. If it's missing, ask the user to set it — never ask them to paste it into the chat.
- **Tools:** the `dedal-mcp` server (`figma_to_template`, `validate_template`, `contract_schema`) if it's configured; otherwise the CLI — `npx dedal-figma pull <url> --mapping <module> [--out file.json] [--images public/figma]`. Both give the same conversion and the same report.

## The workflow

1. **Read the contract first** — `contract_schema` (or the contract file the mapping imports): which components exist, their props and allowed values, their slots (`'one'` / `'many'`). This is what a template may contain.
2. **Pull without writing** — `figma_to_template` without `out` (CLI: without `--out`). Read the whole report before changing anything.
3. **Sort what the report says**, item by item:
   - **`unmapped` — a layer left out**, with its Figma path and the reason:
     - *an instance of "X", which no contract component maps* → X is a library component whose name differs from the contract's: add `component('X', …)` to the mapping, or a `componentName` rule for a whole library (`name => name.replace(/ \(Radix\)$/, '')`). If no contract component fits, it's a **missing component** — see step 4.
     - *a text layer outside any mapped component* → loose text: map its frame with `frame('name', { prop: layer('layer name') })`, or enable `text: '<text component>'` if the contract has a text block, or it belongs in a component property in Figma.
     - *inside an instance of "X"* → content inside a component that isn't in a native slot: in Figma, put it in a slot or expose it as a property.
     - decorative layers (illustrations, mock-ups, diagrams) → `ignore: ['layer name', /pattern/]` in the options, or an image component in Figma.
   - **`warnings`** — an empty container, several slots merged into children: usually a mapping that's too broad (a `frame()` pattern matching more than intended) or slots to map with `component(…, { slots, children })`.
   - **`errors`** — the template doesn't match the contract, with the template path and the Figma layer: a variant or a value the code doesn't have, a missing required prop, an unknown slot.
4. **Decide where each fix belongs — and say it:**
   - **The mapping** (a name differs, a value needs a map: `variant('Kind', { Primary: 'primary' })`, a swap needs a transform: `swap('Icon', name => name.replace('icon/', ''))`) → change the mapping module. This is safe: it changes only how Figma is read.
   - **The Figma file** (a layer outside a component, a drawn illustration, a misnamed layer) → tell the user exactly which layer (its path) and what to change; don't work around a design problem in the mapping.
   - **The contract and the registry** (a new component, a new variant, a new prop) → a code change that every frontend must ship before a template uses it. **Propose it and ask** — never extend the contract on your own to make a pull pass, and never use `force` without the user's explicit OK.
5. **Pull again** until the report is clean or only has items the user accepted. Then write the templates (`out`) and, if the mapping uses `image()`, download the images (`images: 'public/figma'`).
6. **Check the result** — `validate_template` on the written file; if the project has a page that renders it, run it and look (with `?debug=1` if the project mounts Dedal's devtools).

Report back: what was converted (sections), what was left out and why, which fixes you made in the mapping, and which the user should make in Figma or approve in the contract.

## A new mapping

When a project has a contract but no mapping yet:

1. Read the contract (`contract_schema`) and the Figma frame's structure (the Figma MCP server's `get_metadata` / `get_design_context`, or a first pull with an empty mapping: `export default mapping(contract, {}, { section: '<a container component>' })`).
2. Start with **no entries** — the convention maps components, properties and slots whose names match the contract (case, spaces, dashes and Figma's `#id` suffixes don't matter).
3. Add an entry only for what the report shows doesn't match. Prefer one rule over many entries (`componentName`), and `frame()` with exact names over broad patterns.
4. Keep the mapping next to the contract it imports, in plain JavaScript if the CLI loads it.

## Rules

- One contract per component library: a design built on library A is converted with A's contract and rendered with A's registry.
- `ok: true` means *valid against the contract*, not *faithful to the design* — always read `unmapped` and `warnings`.
- Never commit a token, never print it, never put it in a file.
- Don't hand-edit a pulled template to hide a problem — fix the mapping, the file, or the contract, and pull again.
