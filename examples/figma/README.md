# Dedal — a page from Figma

A landing page designed in Figma, pulled by `dedal-figma` and rendered by Dedal. Nothing on the page is written in JSX: the structure, the texts and the images come from the Figma frame; the code only knows the components.

- **The Figma file:** [Dedal — landing](https://www.figma.com/design/AOw4RpmACCpyhHI9YXRJVG/Dedal?node-id=31-398) — sections built from the file's library components (`Section`, `Hero`, `SectionHeading`, `Grid`, `Split`, `Step`, `CTA`, `Footer`…), their content in native Figma slots.
- **`ui/contract.mjs`** — the contract of that design system: components, props, slots (plain JavaScript, so the CLI can load it too).
- **`figma.mapping.mjs`** — Figma → templates: two lines, everything else follows the naming convention.
- **`templates/home.json`** — the template `npm run pull` wrote; **`public/figma/`** — its images.
- **`ui/registry.tsx`** — the React components (shadcn/ui, Tailwind, Geist) for every contract component.
- **`ui/home.ts`, `app/page.tsx`** — the template checked against the contract, built, resolved and rendered; `?debug=1` mounts the devtools panel.

```bash
npm install              # in the repository root first (the package build needs its dev dependencies)
cd examples/figma
npm run dedal            # build the package → npm pack → install from vendor/
FIGMA_TOKEN=… npm run pull   # fetch the frame, convert, validate, download the images
npm run dev              # http://localhost:3000 — add ?debug=1 for the devtools panel
```

The template in the repository works without a token; its images are placeholders until the first `npm run pull`.

## The loop

1. Change the frame in Figma: reorder the sections, edit a heading, switch a button's variant, swap a feature's icon, add a card to a grid.
2. `npm run pull` — the frame is converted and validated against the contract; what didn't make it into the template is listed with its Figma layer path (here: one icon in the deliberately messy `Frame 427`).
3. Reload the page — it follows, with no code change. With `?debug=1`, click any element: the panel shows where each prop came from.

A change the contract doesn't allow — a variant the code doesn't have, a component no registry renders — stops the pull with the template path and the Figma layer, before anything is written.

## With an agent

The same pull through the `dedal-mcp` server — for Claude Code, a `.mcp.json` in this directory:

```json
{ "mcpServers": { "dedal": { "command": "npx", "args": ["dedal-mcp"], "env": { "FIGMA_TOKEN": "${FIGMA_TOKEN}" } } } }
```

Then ask for the page from the Figma link: the tools `figma_to_template`, `validate_template` and `contract_schema` take `figma.mapping.mjs` as the mapping. With the `figma-to-dedal` skill (`skills/figma-to-dedal/SKILL.md` in the repository, copied to `.claude/skills/`), the agent also sorts the report — what to fix in the mapping, what to change in Figma, what needs a contract change you approve.
