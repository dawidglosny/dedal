# Contributing

Thanks for taking the time. Bug reports, questions and pull requests are welcome — for anything larger than a fix, open an issue first, so we can agree on the shape before you write the code.

## Setup

```bash
npm install          # the package and its dev dependencies
npm test             # unit tests (vitest)
npm run typecheck    # TypeScript, no emit
npm run build        # dist/ (tsup)
npm run bench        # performance: build + resolve on large pages
```

Requires Node 20.9+.

## Where things are

| Path | What |
|---|---|
| `src/` | the package: the core (`dedal`), `react/` (`dedal/react`), `devtools/` (`dedal/devtools`, the panel) |
| `test/` | unit tests, one file per area |
| `site/` | the documentation site — <https://dawidglosny.github.io/dedal/> |
| `examples/next`, `examples/web-components` | examples that install the package like a user would |
| `docs/API.md` | the API reference (rendered on the site too) |
| `docs/ROADMAP.md` | open plans and the principles behind them |
| `docs/adr/` | decision records — read [001](docs/adr/001-scope.md) (scope) before proposing a larger feature |
| `bench/` | the benchmark behind `npm run bench` |

## The docs site and the examples

They install the package from a local `npm pack`, so they test what a user gets:

```bash
cd site                # or examples/next, examples/web-components
npm run dedal          # build the package → npm pack → install it here
npm run dev            # the site: http://localhost:3000
```

Run `npm run dedal` again after changing anything in `src/`. Every docs case runs its code at build time — `npm run build` in `site/` fails if a case breaks.

## Pull requests

- **Tests** for every change in behaviour; `npm test` and `npm run typecheck` pass.
- **Docs in the same change**: the case or guide on the site, `docs/API.md` for options and formats, JSDoc for exported functions and types.
- **A line in `CHANGELOG.md`** under *Unreleased*.
- **Everything in English** — code, comments, tests, docs.
- **The rules in [docs/API.md](docs/API.md#design-rules)** hold: plain JSON between stages, pure functions, no dependencies in the core, framework bindings in their own entry points.
- **Performance-sensitive changes** come with a before / after from `npm run bench`.

Commit messages: a short subject saying what changed (`Devtools: closing the panel clears the highlight`), details in the body when they help.
