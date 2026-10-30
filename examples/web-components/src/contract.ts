import type { Slot } from 'dedal'

/**
 * The component contract — shared by the server (templates, data) and the browser (registry).
 * Prop names avoid HTMLElement properties (`title`, `hidden`…): the renderer sets props as element properties.
 */
export type Contract = {
  hero: { heading?: string; lead?: string; actions?: Slot[] }
  button: { label?: string; href?: string; variant?: 'solid' | 'outline' }
  section: { heading?: string }
  grid: { columns?: 1 | 2 | 3 | 4 }
  card: { heading?: string; href?: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }
  badge: { label?: string; tone?: 'neutral' | 'accent' }
}

/** Every component name at runtime — to validate templates that come from outside the code. */
export const components = ['hero', 'button', 'section', 'grid', 'card', 'badge'] as const satisfies readonly (keyof Contract)[]

export type Ctx = { device: 'desktop' | 'mobile' }
