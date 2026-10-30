/** Short description of a value for error messages: `string "two columns"`, `number 42`, `array (3 items)`, `null`. */
export function describeValue(value: unknown, max = 40): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `array (${value.length} items)`
  if (typeof value === 'string') return `string ${JSON.stringify(value.length > max ? `${value.slice(0, max - 1)}…` : value)}`
  if (typeof value === 'object') return 'object'
  return `${typeof value} ${String(value)}`
}
