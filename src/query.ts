import { hashKey, type Cache, type CacheKey, type CacheTimes } from './cache'
import { ms, now, type AsyncContext, type QueryTiming } from './timing'

/** Key namespaces in the instance store — page entry `['menu']` and query `['menu']` are different entries. */
export const PAGE_NAMESPACE = 'page'
export const QUERY_NAMESPACE = 'query'

/** Namespaced key; `undefined` (no cache) stays `undefined`. */
export const namespaced = (namespace: string, key: CacheKey | undefined): CacheKey | undefined =>
  key === undefined ? undefined : [namespace, ...key]

/** Query definition: key, data fetching and entry lifetimes. */
export type QueryOptions<P, T> = CacheTimes & {
  /** Entry key — must cover all `fn` parameters; `undefined` = no cache for this call. */
  key: (params: P) => CacheKey | undefined
  /** Data fetching (IO). The result must be JSON — external stores serialize it. */
  fn: (params: P) => T | Promise<T>
}

/**
 * Query: `(params) => Promise<T>` from the instance cache. The result is frozen and shared —
 * read-only (`[...items].sort()` instead of `items.sort()`).
 */
export type Query<P, T> = unknown extends P ? (params?: P) => Promise<T> : (params: P) => Promise<T>

/** Creates a query on the instance cache. Inside a traced build (`context`) every call is recorded with its cache status. */
export function createQuery<P, T>(cache: Cache, options: QueryOptions<P, T>, context?: () => AsyncContext | undefined): Query<P, T> {
  const run = (params: P) => {
    const key = namespaced(QUERY_NAMESPACE, options.key(params))
    const trace = context?.()?.getStore()
    if (!trace) return cache.fetch(key, async () => options.fn(params), options)

    const start = now()
    let status: QueryTiming['status'] = 'miss'
    const record = () =>
      trace.queries.push({
        key: key ? hashKey(key) : '',
        status,
        start: ms(start - trace.origin),
        duration: ms(now() - start),
        ...(trace.loader !== undefined && { loader: trace.loader }),
      })

    return cache.fetch(key, async () => options.fn(params), options, value => (status = value)).then(
      value => (record(), value),
      error => {
        status = 'error'
        record()
        throw error
      }
    )
  }

  return run as Query<P, T>
}
