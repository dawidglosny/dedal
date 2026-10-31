// The contract of the landing's design system: section components with their properties and slots, and the
// shadcn/ui components the Figma file uses. Plain JavaScript, so the `dedal-figma` CLI (Node) can load it too.
import { z } from 'zod'
import { defineContract } from 'dedal'

export const contract = defineContract({
  section: { props: z.object({ tone: z.enum(['default', 'muted', 'dark']).optional() }) },
  navbar: { slots: { links: 'many', actions: 'many' } },
  hero: {
    props: z.object({ title: z.string(), lead: z.string(), install: z.string().optional() }),
    slots: { badge: 'one', actions: 'many', media: 'one' },
  },
  sectionHeading: {
    props: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      align: z.enum(['center', 'start']).optional(),
      tone: z.enum(['default', 'inverse']).optional(),
    }),
    slots: { badge: 'one' },
  },
  grid: {},
  split: { slots: { content: 'many', media: 'one' } },
  image: { props: z.object({ alt: z.string(), src: z.string().optional() }) },
  step: { props: z.object({ number: z.string(), title: z.string(), description: z.string() }) },
  checkItem: { props: z.object({ text: z.string(), tone: z.enum(['default', 'inverse']).optional() }) },
  codeBlock: { props: z.object({ filename: z.string(), code: z.string() }) },
  cta: { props: z.object({ title: z.string(), lead: z.string() }), slots: { actions: 'many' } },
  footer: { props: z.object({ tagline: z.string() }), slots: { links: 'many' } },
  link: { props: z.object({ label: z.string(), href: z.string().optional() }) },
  text: { props: z.object({ text: z.string(), style: z.string().optional() }) },
  button: {
    props: z.object({
      label: z.string(),
      variant: z.enum(['default', 'secondary', 'outline', 'ghost', 'brand']).optional(),
      size: z.enum(['default', 'lg']).optional(),
      iconRight: z.boolean().optional(),
      href: z.string().optional(),
    }),
  },
  badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary', 'outline', 'brand', 'accent']).optional() }) },
  feature: { props: z.object({ title: z.string(), description: z.string(), icon: z.string().optional() }) },
})
