---
name: figma-component-to-code
description: Turn a component from a Figma design system into code — a contract entry, a React component in the registry, and the mapping entry if needed — asking the user wherever the design leaves a choice open. Use when a Figma component has no counterpart in the code (a pull reported "an instance of X, which no contract component maps", or an audit listed it as missing), when the user wants to add a component from Figma to their design system's code, or to check a component that drifted from the contract.
---

# A Figma component → a contract entry and a registry component

Dedal's contract lists the components a page can use, their props and slots; the registry gives each one a React component. This skill takes a component that exists in the Figma library and not yet in the code, and adds it — deterministically where the design says enough (the props, their types and values come from Figma's component properties), and by **asking the user** wherever it doesn't. Nothing is added to the contract or the registry before the user approves it.

It's useful beyond Dedal pages too: on any design system kept in Figma, it turns a designed component into its typed props and a component skeleton in the house style.

## What you need

- **The component in Figma:** a URL with `?node-id=…` pointing at the component, the component set, or any instance of it (it's resolved to the main component).
- **The project's mapping module** (`figma.mapping.mjs` — search for `from 'dedal/figma'`) — to compare with the existing contract; and the contract file it imports.
- **`FIGMA_TOKEN`** in the environment (a personal access token, file content read access). If it's missing, ask the user to set it — never to paste it into the chat.
- **Tools:** `dedal-mcp` (`figma_component_to_contract`, `figma_audit`, `contract_schema`) or the CLI (`npx dedal-figma component <url> --mapping <module>`, `npx dedal-figma audit <file> --mapping <module>`). For the look: Figma's own MCP server (`get_design_context`, `get_screenshot`) if it's available.

## The workflow

1. **See what's missing** (optional, when the user asks "what does the code lack"): `figma_audit` — components that match the contract, components that drifted, components missing in the code. Show the list; let the user pick.
2. **Get the proposal:** `figma_component_to_contract` with the component's URL and the mapping. It returns:
   - the contract entry as code (zod) — props from the component properties, slots from the native slots,
   - a registry entry to start from,
   - a mapping entry, when the convention won't find the component or a swap needs a transform,
   - **questions** it can't answer from the design,
   - with the mapping: whether the contract already has it, and how it differs.
3. **Ask the user** — every question from the proposal, plus your own where the design is open. Typical ones:
   - which texts are required, which optional (data may fill them),
   - each slot: one block or a list,
   - an instance swap: keep the full component name (`icon/braces`) or a shorter value (`braces`),
   - a library suffix in the name (`Button (Radix)`): a `componentName` rule and the plain key, or a separate component,
   - the component's name in code, if the Figma name isn't a good one,
   - where the component's file goes and which existing component it should follow in style.

   Ask in one round where you can; don't guess an answer that changes the contract.
4. **If the contract already has it** (the proposal shows a drift): the design has props, values or slots the contract lacks — or the contract has props the design doesn't. Show the difference and ask what to do: extend the contract, change the design, or leave it (a prop filled by data). Don't change either side without an answer.
5. **Write the component:** read the design (Figma MCP `get_design_context` / `get_screenshot`, or the proposal's props if that's not available), and write the React component next to the existing registry components — same libraries, same styling approach, same file layout. Props and slots exactly as in the contract entry; slots arrive as props named after the slot, the block's children as `children`.
6. **Show the change, then apply it** — the contract entry, the registry entry (and its file), the mapping entry if any. Apply after the user approves.
7. **Check:** type-check the project (`satisfies Registry<…>` catches a wrong prop); `validate_template` on an existing template if one uses the component; if a frame with the component exists, `figma_to_template` without `out` should no longer report it.

Report back what you added, where, and what the user decided on each question.

## Rules

- The contract is the source of truth for every frontend: a new component or prop is a change every registry has to follow. Propose it; apply it only after approval.
- Ask instead of guessing whenever an answer changes the contract or the component's API.
- Keep the generated component plain and in the house style — no new dependencies without asking.
- Never commit, print or store the Figma token.
