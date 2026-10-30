const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype

/**
 * Deep-merges objects, returning a new object.
 *
 * - plain objects are merged recursively,
 * - any other value (array, `undefined`, primitive) from `override` replaces the value from `base`.
 *
 * @internal
 */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const current = result[key]
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value
  }

  return result as T
}
