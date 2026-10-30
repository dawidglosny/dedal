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
  sections: [section('news', cards(ui, 'Najnowsze', 3))],
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
  sections: [section('shortcuts', node('section', { props: { title: 'Na skróty' }, children: [node('list', { props: { items: [] } })] }))],
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
  sections: [withBrokenToProps.section('news', cards(withBrokenToProps, 'Najnowsze', 2))],
  data: async () => {
    const list = await articles(2)
    return { news: { card: list, 'card > :slot(badge)': list.map(article => article.category) } }
  },
})
// #endregion

// #region data-without-node
async function dataWithoutNode(): Promise<CaseOutput> {
  const page = ui.page<Ctx>({
    sections: [section('news', cards(ui, 'Najnowsze', 2))],
    data: async () => ({ news: { card: await articles(2) } }),
  })
  return {
    ...(await build(ui, page)()),
    // data for a node that is not in the layout — e.g. a cached layout combined with fresh data
    beforeResolve: result => ({ ...result, data: { ...result.data, 'news.0.7': { headline: 'Stary układ' } } }),
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
      'Registry mapuje nazwy component z kontraktu na komponenty React. `satisfies Registry<Contract>` wyłapuje brak przy kompilacji; w runtime (np. starszy front, nowszy serwer) `<Render>` renderuje `fallback` albo nic.\n\nZ `<Render debug>` node bez component dostaje znacznik `data-dedal-missing`, a devtools: `✗ badge is not in the registry — 3 nodes rendered by the fallback (or nothing): …`; w *tree* `!`.',
    registry: registryWithoutBadge,
    run: build(ui, registryMissing),
  },
  {
    slug: 'data-not-object',
    title: 'Data that is not an object',
    level: 'error',
    description:
      'Bez `toProps` data node są złączane z propsami — muszą być obiektem. Gdy przyjdzie string albo liczba, `resolve` zgłasza issue, a node dostaje props z layoutu (render się nie wywraca).\n\nDevtools: `!` w *tree*, w *node* — `data for "grid" is not an object (got string "two columns") — pass an object or add toProps for "grid"; the node keeps its layout props`.',
    run: build(ui, dataNotObject),
  },
  {
    slug: 'to-props-throws',
    title: 'toProps that throws',
    level: 'error',
    description:
      'Wyjątek w `toProps` (np. data w innym kształcie, niż mapowanie zakłada) jest łapany — node dostaje props z layoutu, a issue trafia do `resolved.issues`.\n\nDevtools: `toProps("list") threw: … — the node keeps its layout props`.',
    run: build(ui, toPropsThrows),
  },
  {
    slug: 'to-props-non-object',
    title: 'toProps returning a non-object',
    level: 'error',
    description:
      '`toProps` musi zwrócić obiekt props. Inna wartość (tu string — mapowanie zwraca samo data zamiast `{ label }`) — issue, node dostaje props z layoutu.\n\nDevtools: `toProps("badge") must return an object, got string "Kategoria A" — the node keeps its layout props`.',
    run: build(withBrokenToProps, toPropsNonObject),
  },
  {
    slug: 'data-without-node',
    title: 'Data without a node',
    level: 'error',
    description:
      'Data przypisane do ID, którego nie ma w layoucie — zwykle layout i data są rozjechane (np. layout z cache, data świeże, a blok się zmienił). Data są pomijane.\n\nDevtools (issues strony): `✗ news.0.7 data for an ID that has no node in the layout — layout and data are out of sync …`.',
    run: dataWithoutNode,
  },
  {
    slug: 'on-issue-throw',
    title: 'resolve with onIssue: throw',
    level: 'throws',
    description:
      'Domyślnie problemy `resolve` trafiają do `issues`, a render trwa dalej (`onIssue: "collect"`). `onIssue: "throw"` zamienia pierwszy w wyjątek — np. w testach albo CI, żeby żaden issue nie przeszedł niezauważony.',
    run: onIssueThrow,
  },
]
