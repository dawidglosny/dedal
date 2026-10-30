import type { Slot } from 'dedal'

/**
 * Component contract — the single source of truth, shared by the server and every registry.
 *
 * Vocabulary close to Radix Themes and shadcn/ui (container, grid, flex, card, badge, avatar, button, tabs,
 * separator), but the values are neutral (`sm | md | lg`, `default | secondary | outline`) — each registry
 * translates them to its library's API. Types only: it can be extracted into a separate package.
 */
export type Contract = {
  container: { size?: 'sm' | 'md' | 'lg' }
  section: { title?: string; description?: string }
  grid: { columns?: 1 | 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' }
  flex: { direction?: 'row' | 'column'; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' }
  hero: { title: string; description?: string; href?: string; media?: Slot; actions?: Slot[] }
  card: {
    title: string
    href: string
    description?: string
    image?: string
    size?: 'sm' | 'md' | 'lg'
    badge?: Slot
    footer?: Slot
  }
  badge: { label: string; variant?: 'default' | 'secondary' | 'outline' }
  avatar: { name: string; src?: string }
  button: { label: string; href?: string; variant?: 'default' | 'secondary' | 'outline' | 'ghost' }
  image: { src: string; alt?: string; ratio?: '16:9' | '4:3' | '1:1' }
  tabs: { labels: string[]; content?: Slot[] }
  list: { items: { title: string; href: string; meta?: string }[] }
  separator: Record<string, never>
}

/** Page context — serializable (may go over the network or into a cache key). */
export type Ctx = { device: 'desktop' | 'mobile' }
