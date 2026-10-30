/** Entry key: an array of JSON values, e.g. `['home', ctx.device]`. */
export type CacheKey = readonly unknown[]

/** Store entry: the `build` result and the write time (ms, clock from the `now` option). */
export type CacheEntry = { value: unknown; storedAt: number }

/**
 * Entry store. Built-in: `memoryStore()`; Redis, Mongo, KV — adapters on the application side.
 * Keys are the result of `hashKey()`; values are plain JSON (`PageResult`).
 */
export type Store = {
  get(key: string): CacheEntry | undefined | Promise<CacheEntry | undefined>
  /** `ttl` (ms) = `maxAge` — the store may remove expired entries itself. */
  set(key: string, entry: CacheEntry, options: { ttl: number }): void | Promise<void>
  delete(key: string): void | Promise<void>
  /** Optional: removes all keys starting with `prefix`. Without it `invalidate` removes only the full key. */
  deletePrefix?(prefix: string): void | Promise<void>
  /**
   * Optional: a distributed lock for the duration of a refresh (deduplication across instances).
   * `null` = another instance is refreshing — a stale entry stays unrefreshed, a missing entry builds anyway.
   */
  lock?(key: string, ttl: number): Promise<{ release(): void | Promise<void> } | null>
}

/** `hit` — fresh entry; `stale` — old entry + background refresh; `miss` — waiting for `build`; `bypass` — no cache. */
export type CacheStatus = 'hit' | 'stale' | 'miss' | 'bypass' | 'error'

/** A cache event passed to `onEvent`: the key, the status (`hit`, `stale`, `miss`, `bypass`, `error`) and the time it took. */
export type CacheEvent = {
  /** Result of `hashKey()`; empty for `bypass`. */
  key: string
  status: CacheStatus
  /** Handling time (ms) according to the `now` clock. */
  ms: number
  /** Only for `status: 'error'`. */
  error?: unknown
}

/** Entry lifetimes — set for the instance and overridden per page. */
export type CacheTimes = {
  /** Up to this age (ms) the entry is fresh and returned without refreshing. Default 5 s. */
  staleTime?: number
  /** Up to this age (ms) the old entry is returned with a background refresh; older = `miss`. Default 5 min. */
  maxAge?: number
}

/** Instance cache (`createDedal({ cache })`): store and default times, shared by all pages. */
export type CacheOptions = CacheTimes & {
  /** Default `memoryStore()`. */
  store?: Store
  /** Edge: hands the background refresh over to the environment (e.g. `waitUntil` from `@vercel/functions`). */
  waitUntil?: (promise: Promise<unknown>) => void
  /** Cache events — for logs and metrics. */
  onEvent?: (event: CacheEvent) => void
  /** Clock (ms). Default `Date.now`. */
  now?: () => number
}

/** Page cache (`page({ cache })`). Without this option the page is not cached. */
export type PageCacheOptions<Ctx> = CacheTimes & {
  /**
   * Entry key — must cover everything `sections(ctx)` and `data(ctx)` depend on;
   * `undefined` = no cache for this request. Keys are shared across the instance — start with the page name.
   */
  key: (ctx: Ctx) => CacheKey | undefined
}

/** Instance cache: shared store, default times, invalidation. */
export type Cache = {
  /**
   * Returns the result of `run` from cache by key and times (stale-while-revalidate, deduplication).
   * The result is always a frozen copy (also on the first fetch) — read-only.
   */
  fetch<T>(key: CacheKey | undefined, run: () => Promise<T>, times?: CacheTimes, onStatus?: (status: CacheStatus) => void): Promise<T>
  /** Removes entries whose key starts with `prefix`; `[]` = all. */
  invalidate(prefix: CacheKey): Promise<void>
}

const DEFAULT_STALE_TIME = 5_000
const DEFAULT_MAX_AGE = 5 * 60_000
const LOCK_TTL = 30_000

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype

/** Deterministic key serialization: object keys are sorted, so `{ a, b }` and `{ b, a }` are the same entry. */
export function hashKey(key: CacheKey): string {
  return JSON.stringify(key, (_, value: unknown) =>
    isPlainObject(value) ? Object.fromEntries(Object.keys(value).sort().map(name => [name, value[name]])) : value
  )
}

const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }

  return value
}

/**
 * In-process memory store: LRU with an entry limit. The entry is copied and frozen on write —
 * many requests get the same object, so a mutation throws instead of corrupting other pages,
 * and application objects (e.g. loader data) stay untouched.
 */
export function memoryStore({ max = 500 }: { max?: number } = {}): Store {
  const entries = new Map<string, { entry: CacheEntry; expiresAt: number }>()

  return {
    get(key) {
      const stored = entries.get(key)
      if (!stored) return undefined

      entries.delete(key)
      if (stored.expiresAt <= Date.now()) return undefined

      entries.set(key, stored)
      return stored.entry
    },
    set(key, entry, { ttl }) {
      entries.delete(key)
      if (entries.size >= max) entries.delete(entries.keys().next().value!)

      // values from createCache are already frozen copies; foreign ones — we copy, so as not to freeze application objects
      const value = Object.isFrozen(entry.value) ? entry.value : deepFreeze(structuredClone(entry.value))
      const frozen = { value, storedAt: entry.storedAt }
      entries.set(key, { entry: frozen, expiresAt: Date.now() + ttl })
    },
    delete(key) {
      entries.delete(key)
    },
    deletePrefix(prefix) {
      for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key)
    },
  }
}

const resolveTimes = (times: CacheTimes, fallback: Required<CacheTimes>): Required<CacheTimes> => {
  const staleTime = times.staleTime ?? fallback.staleTime
  const maxAge = times.maxAge ?? Math.max(fallback.maxAge, staleTime)

  if (!(staleTime >= 0) || !(maxAge >= staleTime)) {
    throw new RangeError(`cache: required 0 <= staleTime <= maxAge, got staleTime ${staleTime}, maxAge ${maxAge}`)
  }

  return { staleTime, maxAge }
}

/**
 * Creates a cache (stale-while-revalidate, deduplication of in-flight requests): key, `staleTime`, `maxAge`, `invalidate`.
 *
 * - age < `staleTime` → `hit`: entry immediately,
 * - age < `maxAge` → `stale`: entry immediately + background refresh,
 * - no entry or older → `miss`: waiting for the result.
 *
 * Concurrent calls for the same key wait for a single result. Errors are not cached;
 * on a background refresh error the previous entry stays.
 */
export function createCache(options: CacheOptions = {}): Cache {
  const { store = memoryStore(), now = Date.now, waitUntil, onEvent } = options
  const defaults = resolveTimes(options, { staleTime: DEFAULT_STALE_TIME, maxAge: DEFAULT_MAX_AGE })

  const inFlight = new Map<string, Promise<unknown>>()
  // invalidate during a refresh: the result goes to the waiters, but not to the store
  let generation = 0

  const emit = (key: string, status: CacheStatus, start: number, error?: unknown) =>
    onEvent?.({ key, status, ms: now() - start, ...(error !== undefined && { error }) })

  const refresh = <T>(key: string, run: () => Promise<T>, maxAge: number, mustRun: boolean): Promise<T | undefined> => {
    const running = inFlight.get(key) as Promise<T | undefined> | undefined
    if (running) return running

    const promise = (async () => {
      const startedIn = generation
      const lock = store.lock ? await store.lock(key, LOCK_TTL) : undefined

      if (lock === null && !mustRun) return undefined

      try {
        // frozen copy: the same object goes to many requests, and application objects stay untouched
        const value = deepFreeze(structuredClone(await run()))

        if (startedIn === generation) {
          try {
            await store.set(key, { value, storedAt: now() }, { ttl: maxAge })
          } catch (error) {
            emit(key, 'error', now(), error)
          }
        }

        return value
      } finally {
        inFlight.delete(key)
        await lock?.release()
      }
    })()

    inFlight.set(key, promise)
    return promise
  }

  return {
    async fetch<T>(
      cacheKey: CacheKey | undefined,
      run: () => Promise<T>,
      times: CacheTimes = {},
      onStatus?: (status: CacheStatus) => void
    ): Promise<T> {
      const start = now()
      // instance event + this call's status (devtools: query trace); a later background refresh error is not reported here
      const report = (key: string, status: CacheStatus, at: number, error?: unknown) => {
        emit(key, status, at, error)
        onStatus?.(status)
      }

      if (cacheKey === undefined) {
        report('', 'bypass', start)
        return run()
      }

      const { staleTime, maxAge } = resolveTimes(times, defaults)
      const key = hashKey(cacheKey)
      let entry: CacheEntry | undefined

      try {
        entry = await store.get(key)
      } catch (error) {
        report(key, 'error', start, error)
      }

      if (entry) {
        const age = now() - entry.storedAt

        if (age < staleTime) {
          report(key, 'hit', start)
          return deepFreeze(entry.value as T)
        }

        if (age < maxAge) {
          const background = refresh(key, run, maxAge, false).catch(error => emit(key, 'error', start, error))
          waitUntil?.(background)
          report(key, 'stale', start)
          return deepFreeze(entry.value as T)
        }
      }

      try {
        // undefined: we joined a background refresh that yielded the lock to another instance
        const value = (await refresh(key, run, maxAge, true)) ?? (await run())
        report(key, 'miss', start)
        return value
      } catch (error) {
        report(key, 'error', start, error)
        throw error
      }
    },

    async invalidate(prefix) {
      generation++
      const key = hashKey(prefix)

      await store.delete(key)
      // '["home"]' → '["home",' — children of the prefix, without false hits like ['a', 1] / ['a', 10]
      await store.deletePrefix?.(prefix.length ? `${key.slice(0, -1)},` : '[')
    },
  }
}
