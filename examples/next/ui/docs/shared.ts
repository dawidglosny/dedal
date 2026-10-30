import { createDedal, type Page, type DedalOptions } from 'dedal'
import { fetchArticles } from '@/content/articles'
import type { Contract, Ctx } from '../contract'
import { options } from '../dedal'
import type { CaseOutput, Dedal } from './types'

/** A docs instance — the example's options plus overrides (policies, toProps, cache…). */
export const docsUi = (extra: Partial<DedalOptions<Contract>> = {}): Dedal => createDedal<Contract>({ ...options, ...extra })

/** Shared instance for cases without special options. */
export const ui = docsUi()

/** Mock articles (the same source as the home page). */
export const articles = fetchArticles

/** A titled section with a grid of `count` cards (badge slot in each card). */
export const cards = (instance: Dedal, title: string, count: number, description?: string) =>
  instance.node('section', {
    props: { title, ...(description && { description }) },
    children: [
      instance.node('grid', {
        props: { columns: 3 },
        children: [instance.repeat(instance.node('card', { slots: { badge: instance.node('badge') } }), count)],
      }),
    ],
  })

/** Runs a page the way the docs show it: a debug build (trace). */
export const build = (instance: Dedal, page: Page<Contract, Ctx>, ctx: Ctx = { device: 'desktop' }) =>
  async (): Promise<CaseOutput> => ({ ui: instance, page, ctx, result: await page.build(ctx, { trace: true }) })
