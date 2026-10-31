import { defineContract, type InferContract } from 'dedal'
import { z } from 'zod'

/**
 * The contract of a second domain — an analytics dashboard. Nothing in it is about pages or articles:
 * the same engine, a different set of components. A value, so saved layouts can be checked against it.
 */
export const dashboardContract = defineContract({
  /** A row of widgets. */
  board: { props: z.object({ title: z.string().optional(), columns: z.literal([2, 3, 4]).optional() }) },
  /** A widget frame; `span: 2` takes two columns. */
  panel: { props: z.object({ title: z.string().optional(), span: z.literal([1, 2]).optional() }) },
  stat: {
    props: z.object({ label: z.string(), value: z.string(), delta: z.string().optional(), trend: z.enum(['up', 'down', 'flat']).optional() }),
  },
  chart: { props: z.object({ label: z.string(), points: z.array(z.number()) }) },
  table: { props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }) },
  alert: { props: z.object({ text: z.string(), tone: z.enum(['info', 'warning']).optional() }) },
})

export type DashboardContract = InferContract<typeof dashboardContract>

/** Who is looking: the role decides which widgets exist, the customer decides whose data and whose saved layout. */
export type DashboardCtx = { role: 'admin' | 'support' | 'viewer'; customer: string }
