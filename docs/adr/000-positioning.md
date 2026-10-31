# 000 — Positioning: the engine behind pages from Figma and page builders

- **Status:** accepted
- **Date:** 2026-10-31

## Context

Dedal started as a general server-driven UI engine, and the docs described it that way: structure, data and components kept apart, for "any UI whose structure changes more often than its components", with mobile apps listed first.

Reviews by readers new to the library showed two problems with that framing:

- **It invites the wrong comparison.** "Framework-agnostic" and "server-driven" make readers compare Dedal with React Server Components and Web Components — tools that solve different problems (where React runs, how components are shared) — and conclude they don't need it.
- **It promises what isn't there.** Mobile apps need a native renderer and contract versioning; Dedal has neither.

The concrete value is narrower and stronger: a page designed in Figma, or assembled in a page builder, turned into a template and rendered with the product's own design system — without a page written in JSX and without a release for every change. That is also the setup the approach came from.

## Decision

Dedal is positioned as **the engine behind pages generated from Figma or assembled in a page builder (or a CMS), rendered with your own design system** — for web products on a shared design system.

- The headline stays the benefit: *Change screens without changing code.* The positioning sentence comes right after it; the abstraction (structure, data, components) explains how.
- *Who it is for* leads with three cases: pages from Figma, page builders and CMSs, many products on one design system. The general property ("structure that changes on a different schedule than its components") follows as the wider fit.
- **Mobile apps move to *Later*** until there is a native renderer story and contract versioning.

## Alternatives

- **A general server-driven UI engine** (the previous framing). True, but abstract, and it pulls the comparison towards RSC and Web Components.
- **A framework-agnostic UI layer.** Rejected: Dedal doesn't distribute components; framework independence is a consequence of the JSON format, not the point.
- **A page builder / CMS product.** Rejected: Dedal has no editor and shouldn't have one — it is the engine an editor builds on.
- **Mobile-first server-driven UI.** Rejected for now: no native renderer, no versioning; it would be a claim without support.

## Consequences

- README, the docs site's home page and *Why Dedal* lead with Figma and page builders; mobile is under *Later*.
- Priorities follow: the contract available at runtime (a page builder needs its property panels, a Figma converter needs validation), Figma support as part of the package, a page builder example. See the [roadmap](../ROADMAP.md).
- Features that serve only the general case (actions, versioning for native clients) wait until there is a reason to return to mobile.
