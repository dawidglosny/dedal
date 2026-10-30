# Dedal — documentation site

The source of https://dawidglosny.github.io/dedal/: a landing page and the documentation by example — every feature, warning and error as a live page with its code, the rendered result and the devtools report. A static Next.js export: every case runs once at build time, and its devtools payload is embedded in the page, so the devtools panel works on GitHub Pages.

```bash
npm install            # in the repository root (the package build needs its dev dependencies)
cd site
npm run dedal          # build the package → npm pack → install from vendor/
npm run dev            # http://localhost:3000
npm run build          # static export to out/ (PAGES_BASE_PATH=/dedal for GitHub Pages)
```

Deployment: `.github/workflows/pages.yml` builds and publishes the site on every push to `main` (Settings → Pages → Source: GitHub Actions).

| Path | Role |
|---|---|
| `ui/docs/intros.ts` | group pages (Why Dedal, Introduction, Tutorial, Layout…) — prose with `## ` headings, lists and code blocks |
| `ui/docs/*.cases.ts` | cases: description, level, code (the `// #region <slug>` of the file is what the page shows and what runs) |
| `ui/docs/live.ts` | "See it live" hints — what to look for in the devtools panel |
| `ui/docs/doc-view.tsx`, `ui/docs/run.ts` | page layout; running a case: debug build, `resolve`, devtools payload and report |
| `ui/contract.ts`, `ui/dedal.ts`, `ui/to-props.ts`, `ui/registries/radix-themes.tsx` | the contract, instance and registry the cases use — the same as in `examples/next` |
| `app/page.tsx`, `components/*` | the landing page, header, search, code blocks |
