import { defineContract, type InferContract } from 'dedal'
import { z } from 'zod'

/**
 * The component contract — shared by the server (templates, data) and the browser (registry). A value, so the
 * templates in templates/ are checked against it at runtime; the type is inferred from it.
 * Prop names avoid HTMLElement properties (`title`, `hidden`…): the renderer sets props as element properties.
 */
export const contract = defineContract({
  hero: { props: z.object({ heading: z.string().optional(), lead: z.string().optional() }), slots: { actions: 'many' } },
  button: { props: z.object({ label: z.string().optional(), href: z.string().optional(), variant: z.enum(['solid', 'outline']).optional() }) },
  section: { props: z.object({ heading: z.string().optional() }) },
  grid: { props: z.object({ columns: z.literal([1, 2, 3, 4]).optional() }) },
  card: {
    props: z.object({ heading: z.string().optional(), href: z.string().optional(), size: z.enum(['sm', 'md', 'lg']).optional() }),
    slots: { badge: 'one' },
  },
  badge: { props: z.object({ label: z.string().optional(), tone: z.enum(['neutral', 'accent']).optional() }) },
  /** A loading placeholder — the fallback of a deferred section. */
  skeleton: { props: z.object({ label: z.string().optional(), count: z.number().int().min(1).optional() }) },
})

export type Contract = InferContract<typeof contract>

export type Ctx = { device: 'desktop' | 'mobile' }
