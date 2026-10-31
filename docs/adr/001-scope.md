# 001 — Scope: what Dedal is and what it isn't

- **Status:** accepted
- **Date:** 2026-10-31

## Context

A server-driven UI system can grow in many directions — an editor, a component library, client-side state, actions and workflows, a transport. Each would make Dedal bigger and each pulls it towards being a product instead of an engine. The positioning ([000](000-positioning.md)) needs a clear line, so the docs, the roadmap and contributions can be checked against it.

## Decision

**Dedal is** the engine between a template and a rendered page:

- the **contract** — which components exist, their props and slots,
- **templates** — the structure, in code or as JSON,
- **data binding** — data placed by CSS-like selectors, with explicit rules for missing data,
- **pages and sections** — loaders, optional and deferred sections, variants per context,
- the **cache** — pages and data sources,
- **resolve** — final props as plain JSON, renderable anywhere,
- **renderers** — React shipped; others are small and documented,
- **devtools** — where every prop came from and what went wrong.

**Dedal isn't:**

- **an editor** — page builders and Figma produce templates; Dedal renders them,
- **a component library** — components come from the product's design system, through the registry,
- **state management** — interactive widgets keep their state in their own components,
- **an action or workflow engine** — not yet: actions are designed but deferred until mobile or a real need comes back (a future record),
- **a place for code in templates** — templates are data; nothing in them is executed,
- **a transport or a framework** — the core knows neither; framework bindings are separate entry points.

## Alternatives

- **Ship an editor.** Rejected: large, product-specific, and every team's editor differs. A page builder *example* shows how to build one on Dedal.
- **Add actions now.** Deferred: the design follows what other server-driven UI systems converged on (actions as typed data, handlers on the client, a server round trip for forms), but the positioning doesn't need it yet.
- **Client-side variables and expressions in templates.** Rejected: it turns templates into a programming language and moves logic out of reach of types and tests.

## Consequences

- The *Limitations* page and *When it doesn't* in *Why Dedal* follow this list.
- A contribution outside the scope needs a record that changes it first.
- Interactive parts (tabs, forms, a cart) are registry components that receive data through props; the template only places them.
