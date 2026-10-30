/**
 * The contract of a second domain — an analytics dashboard. Nothing in it is about pages or articles:
 * the same engine, a different set of components.
 */
export type DashboardContract = {
  /** A row of widgets. */
  board: { title?: string; columns?: 2 | 3 | 4 }
  /** A widget frame; `span: 2` takes two columns. */
  panel: { title?: string; span?: 1 | 2 }
  stat: { label: string; value: string; delta?: string; trend?: 'up' | 'down' | 'flat' }
  chart: { label: string; points: number[] }
  table: { columns: string[]; rows: string[][] }
  alert: { text: string; tone?: 'info' | 'warning' }
}

/** Who is looking: the role decides which widgets exist, the customer decides whose data and whose saved layout. */
export type DashboardCtx = { role: 'admin' | 'support' | 'viewer'; customer: string }
