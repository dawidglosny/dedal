import type { Registry } from 'dedal/react'
import type { Contract, Ctx } from '../contract'
import { radixThemes } from '../registries/radix-themes'
import { options } from '../dedal'
import { articles, build, cards, docsUi, ui } from './shared'
import type { CaseOutput, DocCase } from './types'

const { node, section } = ui

// #region registry-missing
// a registry without "badge" (e.g. an older frontend, a newer server)
const { badge: _badge, ...withoutBadge } = radixThemes
const registryWithoutBadge: Partial<Registry<Contract>> = withoutBadge

const registryMissing = ui.page<Ctx>({
  sections: [section('news', cards(ui, 'Latest', 3))],
  data: async () => {
    const list = await articles(3)
    return { news: { card: list, 'card > :slot(badge)': list.map(article => article.category) } }
  },
})
// <Render tree={resolved} registry={registryWithoutBadge} fallback={Missing} debug />
// #endregion

// #region data-not-object
const dataNotObject = ui.page<Ctx>({
  sections: [section('news', node('grid', { props: { columns: 2 }, children: [node('card')] }))],
  data: async () => ({
    news: {
      grid: ['two columns'], // a string for a component without toProps
      card: await articles(1),
    },
  }),
})
// #endregion

// #region to-props-throws
const toPropsThrows = ui.page<Ctx>({
  // toProps.list: ({ data }) => ({ items: data.map(…) }) — data must be an array of articles
  sections: [section('shortcuts', node('section', { props: { title: 'Shortcuts' }, children: [node('list', { props: { items: [] } })] }))],
  data: async () => ({ shortcuts: { list: ['not a list'] } }),
})
// #endregion

// #region to-props-non-object
const withBrokenToProps = docsUi({
  toProps: {
    ...options.toProps,
    // a mapping returning the data itself (a string) instead of props ({ label })
    badge: ({ data }) => data as never,
  },
})

const toPropsNonObject = withBrokenToProps.page<Ctx>({
  sections: [withBrokenToProps.section('news', cards(withBrokenToProps, 'Latest', 2))],
  data: async () => {
    const list = await articles(2)
    return { news: { card: list, 'card > :slot(badge)': list.map(article => article.category) } }
  },
})
// #endregion

// #region data-without-node
async function dataWithoutNode(): Promise<CaseOutput> {
  const page = ui.page<Ctx>({
    sections: [section('news', cards(ui, 'Latest', 2))],
    data: async () => ({ news: { card: await articles(2) } }),
  })
  return {
    ...(await build(ui, page)()),
    // data for a node that is not in the layout — e.g. a cached layout combined with fresh data
    beforeResolve: result => ({ ...result, data: { ...result.data, 'news.0.7': { headline: 'Old layout' } } }),
  }
}
// #endregion

// #region on-issue-throw
async function onIssueThrow(): Promise<CaseOutput> {
  return {
    ...(await build(ui, dataNotObject)()),
    // resolve(result, { onIssue: 'throw' }) — every issue becomes an exception (e.g. in tests or CI)
    resolveOptions: { onIssue: 'throw' },
  }
}
// #endregion

export const renderingCases: DocCase[] = [
  {
    slug: 'registry-missing',
    title: 'Component missing from the registry',
    level: 'error',
    description:
      'The registry maps component names from the contract to React components. `satisfies Registry<Contract>` catches a missing one at compile time; at runtime (e.g. an older frontend, a newer server) `<Render>` renders the `fallback` or nothing.\n\nWith `<Render debug>` a node without a component gets the `data-dedal-missing` marker, and devtools show: `✗ badge is not in the registry — 3 nodes rendered by the fallback (or nothing): …`; in *tree* a `!`.',
    registry: registryWithoutBadge,
    run: build(ui, registryMissing),
  },
  {
    slug: 'data-not-object',
    title: 'Data that is not an object',
    level: 'error',
    description:
      'Without `toProps` a node\'s data is merged with its props — so it must be an object. When a string or a number arrives, `resolve` reports an issue and the node gets the props from the layout (rendering doesn\'t fail).\n\nDevtools: `!` in *tree*, and in *node* — `data for "grid" is not an object (got string "two columns") — pass an object or add toProps for "grid"; the node keeps its layout props`.',
    run: build(ui, dataNotObject),
  },
  {
    slug: 'to-props-throws',
    title: 'toProps that throws',
    level: 'error',
    description:
      'An exception in `toProps` (e.g. data in a different shape than the mapping expects) is caught — the node gets the props from the layout, and the issue goes to `resolved.issues`.\n\nDevtools: `toProps("list") threw: … — the node keeps its layout props`.',
    run: build(ui, toPropsThrows),
  },
  {
    slug: 'to-props-non-object',
    title: 'toProps returning a non-object',
    level: 'error',
    description:
      '`toProps` must return a props object. Any other value (here a string — the mapping returns the data itself instead of `{ label }`) is an issue, and the node gets the props from the layout.\n\nDevtools: `toProps("badge") must return an object, got string "Category A" — the node keeps its layout props`.',
    run: build(withBrokenToProps, toPropsNonObject),
  },
  {
    slug: 'data-without-node',
    title: 'Data without a node',
    level: 'error',
    description:
      'Data assigned to an ID that isn\'t in the layout — usually layout and data are out of sync (e.g. the layout from the cache, fresh data, and the block has changed). The data is skipped.\n\nDevtools (page issues): `✗ news.0.7 data for an ID that has no node in the layout — layout and data are out of sync …`.',
    run: dataWithoutNode,
  },
  {
    slug: 'on-issue-throw',
    title: 'resolve with onIssue: throw',
    level: 'throws',
    description:
      'By default `resolve` problems go to `issues` and rendering continues (`onIssue: "collect"`). `onIssue: "throw"` turns the first one into an exception — e.g. in tests or CI, so that no issue goes unnoticed.',
    run: onIssueThrow,
  },
]
