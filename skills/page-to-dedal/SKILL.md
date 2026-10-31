---
name: page-to-dedal
description: Turn a description of a page ("a landing page with a hero, three feature cards and a call to action") into a Dedal template built only from the components the contract already has — validated, saved, and optionally built as a frame in the Figma file from its library components. Asks the user wherever the description could mean several things. Use when the user describes a page or a section they want, in a project that uses Dedal (a contract with `defineContract`, a mapping with `mapping(contract, …)` from `dedal/figma`).
---

# A description of a page → a Dedal template (and a Figma frame)

A Dedal template is JSON: blocks of contract components with their props, slots and children. This skill composes one from a description — using **only the components that exist** in the contract, never inventing new ones — validates it, saves it, and, if the user wants, builds it as a frame in Figma from the library's own components, so designers can take it from there. Whenever the description leaves a choice open, it **asks** instead of guessing.

## What you need

- **The contract** — read it through `contract_schema` (components, props with their types and allowed values, slots and their kind), and the project's mapping module (`figma.mapping.mjs` — search for `from 'dedal/figma'`).
- **Existing templates and pages**, if there are any (e.g. `templates/*.json`) — they show how the components are combined here; follow them.
- For the Figma frame: the **Figma file** whose library the page uses, `FIGMA_TOKEN` in the environment (ask the user to set it; never to paste it), and the **Dedal plugin** open in Figma desktop (`figma-plugin/` in the package: Plugins → Development → Import plugin from manifest, once; then run it).
- **Tools:** `dedal-mcp` (`contract_schema`, `validate_template`, `template_to_figma`, `figma_audit`), or the CLI (`npx dedal-figma build <file> --template <file.json> --mapping <module>`).

## The workflow

1. **Read the contract and the existing templates.** List the components that can be used: sections (e.g. `section`, `hero`, `cta`), content blocks (`sectionHeading`, `feature`, `step`), small components (`button`, `badge`), and which slots take what.
2. **Plan the page in words and confirm it.** Map the description to sections and components: "hero (title, lead, two buttons) → a `features` section with a heading and a grid of three `feature` cards → a `cta`". **Ask the user** where it's open:
   - several components could fit a part of the description (a quote as `testimonial` or as `text`?),
   - something the description wants has **no component** in the contract — say so; don't invent it, don't fake it with an unrelated component. Offer the alternatives: leave it out, use the closest existing component (named), or add a new component first (the `figma-component-to-code` skill, or a design + contract change the user approves),
   - variants, tones and order the description doesn't say,
   - the texts: use the user's copy, or placeholders clearly marked as such (data or editors will replace them).
3. **Write the template** — one entry per section, keyed by a short stable name (`hero`, `features`, `cta`), only components, props, values and slots the contract allows. Follow the shape of existing templates.
4. **Validate** — `validate_template`; fix every error (the path says where). Don't hand back a template that doesn't validate.
5. **Save it** where the project keeps templates (ask if it isn't obvious), and show it to the user.
6. **Build it in Figma** (if the user wants): `template_to_figma` with the file, the template and the mapping (CLI: `dedal-figma build … --spec plan.json` first to see the plan, then without `--spec`). The tool reports parts of the template that have no counterpart in the Figma library (a component with no library component, a prop with no component property, a value that isn't a variant option) — show them and **ask** before building with `force`. If the plugin isn't open, tell the user how to open it and retry.
7. **Report back:** the sections and components used, what you asked and what the user decided, what was left out and why, the template's path, and the Figma frame (if built).

## Rules

- Only components from the contract. A missing component is a question to the user, never an improvisation.
- Ask before deciding anything the description doesn't say and the user would care about — layout, variants, which component, copy.
- The template must validate before it's saved or built.
- Never use `force` without the user's explicit OK; never store or print the Figma token.
