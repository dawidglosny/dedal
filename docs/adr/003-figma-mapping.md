# 003 — From Figma to templates: a mapping per component

- **Status:** proposed
- **Date:** 2026-10-31

## Context

Pages generated from Figma are the core of Dedal's positioning ([000](000-positioning.md)). A first converter lived in the *Templates from Figma* guide. It relied on conventions invented for it:

- a layer named `slot:badge` inside an instance marked a slot,
- props were written into frame names (`grid columns=3`),
- Figma property names had to equal the contract's prop names.

That isn't how Figma files are built. Checked against current Figma and the tools around it:

- **Component properties are the standard** way to expose content and state: `VARIANT` (states), `TEXT` (content), `BOOLEAN` (toggles), `INSTANCE_SWAP` (e.g. an icon) — and, since June 2026, native **slots** (`SLOT`, with `minChildren` / `maxChildren`).
- **Figma Code Connect**, Figma's own link between components and code, maps **explicitly, per component**: `figma.string('Label')`, `figma.enum('Variant', { Primary: 'primary' })`, `figma.boolean`, `figma.instance`, `figma.children`, `figma.textContent('title')` for plain text layers. Locofy and Builder.io also map by configuration.
- Design-to-code tools ship a **Figma plugin**: select a frame, export.

A real design file confirms it. The demo file *Dedal — landing* (`AOw4RpmACCpyhHI9YXRJVG`; REST API response trimmed to the fields the converter reads, in `test/fixtures/figma-landing.json`) has:

- component sets with standard properties — `Button` (`Label` text, `Icon right` boolean, `variant`, `size`), `Badge` (`Label`, `variant`), `FeatureCard` (`Title`, `Description` texts, `Icon` instance swap),
- names that differ from code (`Label#3:0` vs `label`), and an instance swap that resolves to a component id (`3:10` → `icon/braces`), not a name,
- sections that are plain frames (`hero`, `features`, `section-heading`) with their content in text layers (`title`, `lead`, `subtitle`),
- hidden layers (`visible: false`) — e.g. a button's icon switched off by its boolean property,
- mapping notes written by the designer in component descriptions (*"shadcn/ui `<Button variant size>`. Label → children, Icon right → `<ArrowRight/>`"*) — exactly the information a mapping should hold in code,
- **two versions of the page, on two component libraries** — shadcn/ui and Radix Themes — each with its own component sets and its own property values (`Button`: `variant` default / secondary / outline / ghost / brand, `size` default / lg; `Button (Radix)`: `variant` solid / soft / surface / outline / ghost, `color` accent / gray, `size` 2 / 3).

The REST API (`GET /v1/files/:key/nodes`) returns what the converter needs: instances with `componentId` and `componentProperties`, the `components` / `componentSets` maps (ids → names), `componentPropertyDefinitions`, and `characters` of text layers. Whether it exposes native slots isn't documented; the Plugin API does.

## Decision

A new entry point, **`dedal/figma`**: a **mapping per contract component, modelled on Code Connect**, with convention as the default.

```ts
import { mapping, component, frame, text, boolean, swap, layer } from 'dedal/figma'

// the shadcn/ui version — the contract mirrors shadcn/ui; most props match by convention
export const shadcnFromFigma = mapping(shadcnContract, {
  button: component('Button', {
    label: text('Label'),                              // `variant`, `size` — by convention, values as they are
    iconRight: boolean('Icon right'),
  }),
  badge: component('Badge'),                           // Label → label, variant → variant
  feature: component('FeatureCard', {
    icon: swap('Icon', name => name.replace('icon/', '')), // instance swap → 'braces'
  }),
  // a plain Figma frame → a contract component; content from text layers
  hero: frame('hero', { title: layer('title'), lead: layer('lead') }),
  sectionHeading: frame('section-heading', { title: layer('title'), subtitle: layer('subtitle') }),
})

// the Radix version — its own contract (variant solid / soft…, color, size 2 / 3) and a name rule for the suffix
export const radixFromFigma = mapping(radixContract, { /* … */ }, { componentName: name => name.replace(/ \(Radix\)$/, '') })

const result = await shadcnFromFigma.convert(response, '5:2')
// { ok: true, sections: { hero: block, features: block, … }, unmapped: [layer paths] }
// { ok: false, errors: [{ path: 'features.children[1].props.variant', message }], unmapped }
```

0. **One contract per component library.** A design built on a library is converted with that library's contract and rendered with that library's registry: the shadcn/ui frame becomes a shadcn/ui template and page, the Radix frame a Radix template and page. The contract mirrors the library's components and their values almost one to one — there is no translation to "neutral" values between libraries; that would be a different design, not the same page.
1. **Convention first.** A Figma component (or component set) with the contract component's name, and properties with the props' names, need no configuration — names compared case-insensitively, Figma's `#id` suffix dropped (`Label#3:0` → `label`). A mapping is written only where names differ — e.g. a library suffix in Figma (`Button (Radix)` → `button`), set once for all components with a name rule.
2. **An explicit mapping per component**, as in Code Connect:
   - `text(property)` — a `TEXT` property,
   - `variant(property, values?)` — a `VARIANT` property, optionally with a value map,
   - `boolean(property, values?)` — a `BOOLEAN` property,
   - `swap(property, toValue?)` — an `INSTANCE_SWAP` property, resolved to the swapped component's name (or a value derived from it),
   - `layer(name)` — the content of a text layer inside the node (`textContent` in Code Connect),
   - `slot(property)` — a native Figma slot → a Dedal slot (`'one'` or `'many'` from the contract).
3. **Plain frames** map by name (`frame('hero', …)`), their content from text layers; their child frames and instances become children.
4. **Hidden layers** (`visible: false`) are skipped.
5. **Nothing is dropped silently.** Layers that match no mapping and aren't plain layout are listed in `unmapped`, with their paths (`features.features-row[0]`); purely visual layers (vectors, shapes) are ignored.
6. **Validated against the contract** ([002](002-runtime-contract.md)): the result goes through `validateSections`; errors carry the path in the template, and the Figma layer it came from.
7. **Sections:** every top-level layer of the converted frame is a section — its name is the section key.
8. **Sources:** the input is a node in the REST API shape. First adapter: the REST response (`convert(response, nodeId)`), and a CLI `dedal-figma pull <file> <node>` that fetches it with a token from the environment. A Figma plugin (the Plugin API sees native slots) comes later, on the same mapping.

## Alternatives

- **Naming conventions only** (the prototype): `slot:` layers, props in frame names. Rejected — not how designers work; breaks on the first real file (`Label` vs `label`).
- **Reuse Code Connect files directly.** They describe code to generate (JSX templates), not data to extract; teams that use Code Connect can mirror the same mapping in Dedal's, property by property.
- **AI matching** (as some design-to-code tools do). Not predictable or testable enough for templates that go to production; a mapping is explicit and reviewed.
- **Requiring sections to be components.** Cleaner in the long run (and the recommendation for new files), but existing files use plain frames — supported through `frame()`.

## Consequences

- The *Templates from Figma* guide is rewritten on `dedal/figma`; the prototype converter goes away.
- Tests run on the real, trimmed REST response of the demo file — no network in tests.
- The demo: each version of the landing page converted with its own library's contract and rendered with that library — the shadcn/ui frame as a shadcn/ui page, the Radix frame as a Radix page; the docs site's home page built from one of them by Dedal.
- Open: whether the REST API returns native slots (to check on a file that uses them); the plugin adapter; incremental updates (only changed sections).
