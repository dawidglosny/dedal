import type { CacheStatus } from './cache'

/** A query call during a traced build: key, cache status, timing (ms from the build start), the loader that called it. */
export type QueryTiming = {
  /** `hashKey()` of the query key; empty when the call had no key (`bypass`). */
  key: string
  status: CacheStatus
  start: number
  duration: number
  /** Section key of the loader that called the query; `page` — page `data`. Missing when called outside a loader. */
  loader?: string
}

/** A loader during a traced build: `page` (page `data`) or a section key. */
export type LoaderTiming = { loader: string; start: number; duration: number; failed?: true }

/** Timings of a traced build (`build(ctx, { trace: true })` / `page.section`), in ms. */
export type BuildTiming = {
  /** `page` for `build`, the section key for `page.section`. */
  scope: string
  total: number
  layout: number
  load: number
  assign: number
  loaders: LoaderTiming[]
  /** Query calls; missing without `AsyncLocalStorage` (queries cannot be attributed to a build without it). */
  queries?: QueryTiming[]
}

/** Per-build store kept in the async context: the build origin, collected queries, the current loader. */
export type TraceStore = { origin: number; queries: QueryTiming[]; loader?: string }

/** The part of `AsyncLocalStorage` (node:async_hooks) used here. */
export type AsyncContext = {
  getStore(): TraceStore | undefined
  run<R>(store: TraceStore, fn: () => R): R
}

/** `AsyncLocalStorage` class — from `node:async_hooks`, or global (Next.js, edge runtimes). */
export type AsyncLocalStorageClass = new () => AsyncContext

/** Async context for query timings: the given class or the global `AsyncLocalStorage`; `undefined` when unavailable. */
export function createAsyncContext(Class?: AsyncLocalStorageClass): AsyncContext | undefined {
  const Global = (globalThis as { AsyncLocalStorage?: AsyncLocalStorageClass }).AsyncLocalStorage
  const Context = Class ?? Global
  return Context ? new Context() : undefined
}

export const now = (): number => globalThis.performance?.now() ?? Date.now()

/** Milliseconds rounded to 0.1. */
export const ms = (value: number): number => Math.round(value * 10) / 10
