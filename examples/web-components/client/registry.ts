import type { Contract } from '../src/contract'
import type { Registry } from './render'

// a component missing from this map is a compile error — the same guarantee as `Registry<Contract>` in dedal/react
export const registry = {
  hero: 'ds-hero',
  button: 'ds-button',
  section: 'ds-section',
  grid: 'ds-grid',
  card: 'ds-card',
  badge: 'ds-badge',
} satisfies Registry<Contract>
