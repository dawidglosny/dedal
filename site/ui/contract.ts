import { defineContract, type InferContract } from 'dedal'
import { z } from 'zod'

const size = z.enum(['sm', 'md', 'lg'])

/**
 * Component contract — the single source of truth, shared by the server and every registry. A value: a props schema
 * (zod) and the slots of every component; the type is inferred from it, and templates from outside the code are
 * validated against it (`ui.validate`, devtools).
 *
 * Vocabulary close to Radix Themes and shadcn/ui (container, grid, flex, card, badge, avatar, button, tabs,
 * separator), but the values are neutral (`sm | md | lg`, `default | secondary | outline`) — each registry
 * translates them to its library's API.
 */
export const contract = defineContract({
  container: { props: z.object({ size: size.optional() }) },
  grid: { props: z.object({ columns: z.literal([1, 2, 3, 4]).optional(), gap: size.optional() }) },
  flex: {
    props: z.object({
      direction: z.enum(['row', 'column']).optional(),
      gap: size.optional(),
      align: z.enum(['start', 'center', 'end']).optional(),
    }),
  },
  hero: {
    props: z.object({ title: z.string(), description: z.string().optional(), href: z.string().optional() }),
    slots: { media: 'one', actions: 'many' },
  },
  // #region tutorial
  section: { props: z.object({ title: z.string().optional(), description: z.string().optional() }) },
  card: {
    props: z.object({
      title: z.string(),
      href: z.string(),
      description: z.string().optional(),
      image: z.string().optional(),
      size: z.enum(['sm', 'md', 'lg']).optional(),
    }),
    slots: { badge: 'one', footer: 'one' },
  },
  badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary', 'outline']).optional() }) },
  // #endregion
  avatar: { props: z.object({ name: z.string(), src: z.string().optional() }) },
  button: { props: z.object({ label: z.string(), href: z.string().optional(), variant: z.enum(['default', 'secondary', 'outline', 'ghost']).optional() }) },
  image: { props: z.object({ src: z.string(), alt: z.string().optional(), ratio: z.enum(['16:9', '4:3', '1:1']).optional() }) },
  tabs: { props: z.object({ labels: z.array(z.string()) }), slots: { content: 'many' } },
  list: { props: z.object({ items: z.array(z.object({ title: z.string(), href: z.string(), meta: z.string().optional() })) }) },
  separator: {},
  /** A loading placeholder — e.g. the fallback of a deferred section. */
  skeleton: { props: z.object({ label: z.string().optional(), count: z.number().int().min(1).optional() }) },
})

export type Contract = InferContract<typeof contract>

/** Page context — serializable (may go over the network or into a cache key). */
export type Ctx = { device: 'desktop' | 'mobile' }
