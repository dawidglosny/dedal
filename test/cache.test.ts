import { describe, expect, it, vi } from 'vitest'
import { createCache, createDedal, hashKey, memoryStore, page, section, type CacheEvent, type CacheOptions, type Store } from '../src'

type Contract = { grid: { columns?: number }; card: { title?: string } }
type Ctx = { device: 'desktop' | 'mobile' }

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const statuses = (events: CacheEvent[]) => events.map(event => event.status)

/** Cache with a manual clock and a version counter — each `run()` returns the next version. */
function setupCache(options: CacheOptions = {}) {
  let time = 0
  let version = 0
  const events: CacheEvent[] = []
  const run = vi.fn(async () => `v${++version}`)
  const cache = createCache({ now: () => time, onEvent: event => events.push(event), ...options })

  return { cache, run, events, tick: (ms: number) => (time += ms), fetch: (key: unknown[] = ['k']) => cache.fetch(key, run) }
}

describe('createCache: entry lifecycle', () => {
  it('by default: fresh for 5 s, then a stale entry + background refresh up to 5 min', async () => {
    const { fetch, run, events, tick } = setupCache()

    expect(await fetch()).toBe('v1')
    tick(4999)
    expect(await fetch()).toBe('v1')
    tick(1)
    expect(await fetch()).toBe('v1')
    await flush()
    expect(await fetch()).toBe('v2')

    expect(run).toHaveBeenCalledTimes(2)
    expect(statuses(events)).toEqual(['miss', 'hit', 'stale', 'hit'])
  })

  it('after maxAge waits for a new result', async () => {
    const { fetch, events, tick } = setupCache()

    await fetch()
    tick(5 * 60_000)

    expect(await fetch()).toBe('v2')
    expect(statuses(events)).toEqual(['miss', 'miss'])
  })

  it('per-call times override the defaults', async () => {
    const { cache, run, events, tick } = setupCache()

    await cache.fetch(['k'], run, { staleTime: 0 })
    tick(1)
    await cache.fetch(['k'], run, { staleTime: 0 })

    expect(statuses(events)).toEqual(['miss', 'stale'])
  })

  it('a staleTime longer than the default maxAge raises maxAge', async () => {
    const { cache, run, events, tick } = setupCache()

    await cache.fetch(['k'], run, { staleTime: 10 * 60_000 })
    tick(6 * 60_000)
    await cache.fetch(['k'], run, { staleTime: 10 * 60_000 })

    expect(statuses(events)).toEqual(['miss', 'hit'])
  })

  it('keys do not mix', async () => {
    const { fetch } = setupCache()

    expect(await fetch(['a'])).toBe('v1')
    expect(await fetch(['b'])).toBe('v2')
    expect(await fetch(['a'])).toBe('v1')
  })

  it('undefined key = no cache', async () => {
    const { cache, run, events } = setupCache()

    await cache.fetch(undefined, run)
    await cache.fetch(undefined, run)

    expect(run).toHaveBeenCalledTimes(2)
    expect(statuses(events)).toEqual(['bypass', 'bypass'])
  })

  it('rejects maxAge smaller than staleTime', () => {
    expect(() => createCache({ staleTime: 2000, maxAge: 1000 })).toThrow(RangeError)
  })
})

describe('createCache: deduplication and errors', () => {
  it('concurrent calls for the same key wait for a single result', async () => {
    const { fetch, run } = setupCache()

    const results = await Promise.all(Array.from({ length: 10 }, () => fetch()))

    expect(run).toHaveBeenCalledTimes(1)
    expect(new Set(results)).toEqual(new Set(['v1']))
  })

  it('an error is not cached — the next call computes again', async () => {
    const { fetch, run, events } = setupCache()
    run.mockRejectedValueOnce(new Error('API down'))

    await expect(fetch()).rejects.toThrow('API down')
    expect(await fetch()).toBe('v1')
    expect(statuses(events)).toEqual(['error', 'miss'])
  })

  it('a background refresh error keeps the previous entry', async () => {
    const { fetch, run, events, tick } = setupCache({ staleTime: 0 })

    await fetch()
    run.mockRejectedValueOnce(new Error('API down'))
    tick(1)
    expect(await fetch()).toBe('v1')
    await flush()
    tick(1)
    expect(await fetch()).toBe('v1')

    expect(statuses(events)).toEqual(['miss', 'stale', 'error', 'stale'])
  })

  it('waitUntil receives the background refresh', async () => {
    const waitUntil = vi.fn()
    const { fetch } = setupCache({ staleTime: 0, waitUntil })

    await fetch()
    await fetch()

    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise)
  })

  it('a store failure does not break the call', async () => {
    const broken: Store = {
      get: () => Promise.reject(new Error('redis')),
      set: () => Promise.reject(new Error('redis')),
      delete: () => undefined,
    }
    const { fetch, events } = setupCache({ store: broken })

    expect(await fetch()).toBe('v1')
    expect(statuses(events)).toEqual(['error', 'error', 'miss'])
  })

  it('lock held by another instance: stale entry without a refresh; a missing entry is computed anyway', async () => {
    const store: Store = { ...memoryStore(), lock: vi.fn(async () => null) }
    const { fetch, run } = setupCache({ store, staleTime: 0 })

    expect(await fetch()).toBe('v1')
    await fetch()
    await flush()

    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('createCache: invalidate', () => {
  it('removes entries by prefix', async () => {
    const { cache, run, fetch } = setupCache()

    await fetch(['home', 'desktop'])
    await fetch(['home', 'mobile'])
    await fetch(['about'])
    await cache.invalidate(['home'])
    await fetch(['home', 'desktop'])
    await fetch(['home', 'mobile'])
    await fetch(['about'])

    expect(run).toHaveBeenCalledTimes(5)
  })

  it('a prefix does not catch similar keys', async () => {
    const store = memoryStore()
    const { cache, fetch } = setupCache({ store })

    await fetch(['a', 1])
    await fetch(['a', 10])
    await cache.invalidate(['a', 1])

    expect(store.get(hashKey(['a', 1]))).toBeUndefined()
    expect(store.get(hashKey(['a', 10]))).toBeDefined()
  })

  it('a result computed during invalidate does not reach the store', async () => {
    const cache = createCache()
    let release!: () => void
    const gate = new Promise<void>(resolve => (release = resolve))
    const run = vi.fn(async () => (await gate, 'v'))

    const running = cache.fetch(['k'], run)
    await flush()
    await cache.invalidate([])
    release()
    await running
    await cache.fetch(['k'], run)

    expect(run).toHaveBeenCalledTimes(2)
  })
})

describe('page({ cache })', () => {
  function setupPage(options: { cache?: boolean } = {}) {
    let version = 0
    const load = vi.fn(async (ctx: Ctx) => ({ main: { card: [{ title: `${ctx.device} v${++version}` }] } }))
    const ui = createDedal<Contract>()
    const { node, repeat } = ui
    const home = ui.page<Ctx>({
      sections: [ui.section('main', node('grid', { children: [repeat(node('card'), 1)] }))],
      data: load,
      ...(options.cache !== false && { cache: { key: (ctx: Ctx) => ['home', ctx.device] } }),
    })
    const title = async (device: Ctx['device'] = 'desktop') =>
      (Object.values((await home.build({ device })).data)[0] as { title: string }).title

    return { ui, home, load, title }
  }

  it('caches build by key', async () => {
    const { title, load } = setupPage()

    expect(await title('desktop')).toBe('desktop v1')
    expect(await title('desktop')).toBe('desktop v1')
    expect(await title('mobile')).toBe('mobile v2')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('a page without the cache option is not cached', async () => {
    const { title, load } = setupPage({ cache: false })

    await title()
    await title()

    expect(load).toHaveBeenCalledTimes(2)
  })

  it('a cached result equals the uncached one, is frozen and goes through resolve', async () => {
    const withCache = setupPage()
    const without = setupPage({ cache: false })

    await withCache.home.build({ device: 'desktop' })
    const cachedResult = await withCache.home.build({ device: 'desktop' })

    expect(cachedResult).toEqual(await without.home.build({ device: 'desktop' }))
    expect(Object.isFrozen(cachedResult.sections[0].layout)).toBe(true)
    expect(withCache.ui.resolve(cachedResult).issues).toEqual([])
  })

  it('ui.invalidate works for the instance pages', async () => {
    const { ui, title, load } = setupPage()

    await title()
    await ui.invalidate(['home'])
    expect(await title()).toBe('desktop v2')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('page() outside an instance gets its own cache', async () => {
    const load = vi.fn(async () => ({ a: { card: [{ title: 'x' }] } }))
    const standalone = page<Contract, void>({
      sections: [section<Contract>('a', { component: 'card' })],
      data: load,
      cache: { key: () => ['a'] },
    })

    await standalone.build()
    await standalone.build()

    expect(load).toHaveBeenCalledTimes(1)
  })
})

describe('memoryStore', () => {
  it('freezes a copy of the entry, application objects stay untouched', () => {
    const store = memoryStore()
    const value = { data: { card: { title: 'a' } } }

    store.set('k', { value, storedAt: 0 }, { ttl: 1000 })
    const entry = store.get('k') as { value: typeof value }

    expect(Object.isFrozen(value.data)).toBe(false)
    expect(() => {
      entry.value.data.card.title = 'b'
    }).toThrow(TypeError)
  })

  it('evicts the least recently used entries once over the limit', () => {
    const store = memoryStore({ max: 2 })
    const set = (key: string) => store.set(key, { value: key, storedAt: 0 }, { ttl: 1000 })

    set('a')
    set('b')
    store.get('a')
    set('c')

    expect(store.get('a')).toBeDefined()
    expect(store.get('b')).toBeUndefined()
    expect(store.get('c')).toBeDefined()
  })
})

describe('hashKey', () => {
  it('object key order does not matter', () => {
    expect(hashKey(['home', { device: 'mobile', page: 2 }])).toBe(hashKey(['home', { page: 2, device: 'mobile' }]))
  })

  it('array item order matters', () => {
    expect(hashKey(['a', 'b'])).not.toBe(hashKey(['b', 'a']))
  })
})
