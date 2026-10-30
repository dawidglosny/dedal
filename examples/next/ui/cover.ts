/** Placeholder image: a deterministic gradient from the file name (the example doesn't fetch photos from the network). */
export function coverStyle(src: string | undefined) {
  let hash = 0
  for (const char of src ?? '') hash = (hash * 31 + char.charCodeAt(0)) >>> 0

  const hue = hash % 360
  return { background: `linear-gradient(135deg, hsl(${hue} 60% 55%), hsl(${(hue + 50) % 360} 70% 35%))` }
}

/**
 * Initials for the avatar fallback. A node may be rendered without data (onShortage: 'keep', a section without data),
 * so required props can be missing at runtime — components in a registry should tolerate it.
 */
export const initials = (name: string | undefined) =>
  (name ?? '')
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
