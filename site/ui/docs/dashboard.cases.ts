import type { Page, PageResult } from 'dedal'
import type { Registry } from 'dedal/react'
import type { Contract, Ctx } from '../contract'
import { analytics } from '../dashboard/api'
import type { DashboardContract, DashboardCtx } from '../dashboard/contract'
import { dash } from '../dashboard/dedal'
import { dashboardRegistry } from '../dashboard/registry'
import type { CaseOutput, DocCase, Dedal } from './types'

// #region dashboard-roles
// the structure — rows of widgets, written once
const kpis = dash.node('board', { props: { title: 'Today' }, children: [dash.repeat(dash.node('stat'), 4)] })

const activity = dash.node('board', {
  props: { title: 'Activity', columns: 3 },
  children: [
    dash.node('panel', { alias: 'orders', props: { title: 'Orders, last 12 weeks', span: 2 }, children: [dash.node('chart', { props: { label: 'Orders per week' } })] }),
    dash.node('panel', { alias: 'tickets', props: { title: 'Open tickets' }, children: [dash.node('table', { props: { columns: ['ID', 'Subject', 'Status', 'Age'] } })] }),
  ],
})

// the role adjusts the structure — no copies of the templates
const activityFor = {
  admin: {},
  support: { remove: '#orders', patch: { '#tickets': { span: 2 } } },
  viewer: { remove: '#tickets', patch: { '#orders': { span: 2 } } },
} as const

// the data — fetched only for widgets the role can see, placed by selectors
const ticketRows = async () => (await analytics.tickets()).map(ticket => [ticket.id, ticket.subject, ticket.status, ticket.age])

const roleDashboard = dash.page<DashboardCtx>({
  sections: ({ role }) => [
    dash.section('kpis', kpis, role === 'support' ? { remove: 'stat:nth-child(n+3)' } : {}),
    dash.section('activity', activity, activityFor[role]),
  ],
  data: async ({ role, customer }) => {
    const [metrics, points, rows] = await Promise.all([
      analytics.kpis(customer),
      role !== 'support' ? analytics.ordersSeries() : undefined,
      role !== 'viewer' ? ticketRows() : undefined,
    ])
    return {
      kpis: { stat: metrics.slice(0, role === 'support' ? 2 : 4) },
      activity: { ...(points && { chart: [{ points }] }), ...(rows && { table: [{ rows }] }) },
    }
  },
})
// #endregion

// #region dashboard-customer-layout
// each customer arranges their dashboard in the app's editor; the layout is saved as JSON.
// "acme" moved tickets first, made the chart full width and kept two numbers.
const savedLayouts = new Map<string, string>([
  [
    'acme',
    `{
      "version": 7,
      "sections": {
        "activity": { "component": "board", "props": { "title": "Our week", "columns": 2 }, "children": [
          { "component": "panel", "props": { "title": "Open tickets", "span": 2 }, "children": [
            { "component": "table", "props": { "columns": ["ID", "Subject", "Status", "Age"] } } ] },
          { "component": "panel", "props": { "title": "Orders, last 12 weeks", "span": 2 }, "children": [
            { "component": "chart", "props": { "label": "Orders per week" } } ] }
        ] },
        "kpis": { "component": "board", "props": { "title": "Key numbers", "columns": 2 }, "children": [
          { "component": "stat", "repeat": 2 }
        ] }
      }
    }`,
  ],
])

// the sections come from the customer's saved layout on every build — checked against the contract first
const customerDashboard = dash.page<DashboardCtx>({
  sections: async ({ customer }) => {
    const result = await dash.validateSections(JSON.parse(savedLayouts.get(customer)!).sections)
    if (!result.ok) throw new Error(result.errors.map(({ path, message }) => `${path}: ${message}`).join('\n'))
    return Object.entries(result.value).map(([key, block]) => dash.section(key, block))
  },
  // the same data loader for every customer — it doesn't know the layout
  data: async ({ customer }) => {
    const [metrics, points, rows] = await Promise.all([analytics.kpis(customer), analytics.ordersSeries(), ticketRows()])
    return { kpis: { stat: metrics }, activity: { chart: [{ points }], table: [{ rows }] } }
  },
  // cached per customer and role; when a customer saves a new layout: dash.invalidate(['dashboard', customer])
  cache: { key: ctx => ['dashboard', ctx.customer, ctx.role] },
})
// #endregion

// #region dashboard-missing
const withIncidents = dash.page<DashboardCtx>({
  sections: [
    dash.section('incidents', dash.node('board', { props: { title: 'Incidents', columns: 2 }, children: [dash.repeat(dash.node('alert', { props: { tone: 'warning' } }), 2)] }), {
      optional: true, // the status API being down must not take the dashboard down
      data: async () => ({ alert: (await analytics.incidents()).map(text => ({ text })) }),
    }),
    dash.section('kpis', kpis),
  ],
  data: async ({ customer }) => ({ kpis: { stat: await analytics.kpis(customer) } }),
  onSectionError: (error, { section }) => console.warn(`[docs] ${section}:`, (error as Error).message),
})
// #endregion

// the docs machinery is typed for the content-site contract; the dashboard runs on its own contract
const run = (page: Page<DashboardContract, DashboardCtx>, ctx: DashboardCtx) => async (): Promise<CaseOutput> => ({
  ui: dash as unknown as Dedal,
  page: page as unknown as Page<Contract, Ctx>,
  ctx: ctx as unknown as Ctx,
  result: (await page.build(ctx, { trace: true })) as unknown as PageResult<Contract>,
})
const registry = dashboardRegistry as unknown as Partial<Registry<Contract>>
const files = [
  { title: 'contract', file: 'ui/dashboard/contract.ts' },
  { title: 'instance', file: 'ui/dashboard/dedal.ts' },
]

export const dashboardCases: DocCase[] = [
  {
    slug: 'dashboard-roles',
    title: 'Per role: one set of templates',
    level: 'ok',
    files: [...files, { title: 'registry', file: 'ui/dashboard/registry.tsx' }],
    registry,
    description: `An analytics dashboard: numbers at the top, an orders chart and open tickets below. Three roles see different dashboards — an **admin** everything, **support** the tickets and two numbers, a **viewer** the numbers and the chart.

The three parts, in this domain:
- **structure** — two rows of widgets (\`kpis\`, \`activity\`), adjusted per role with \`remove\` and \`patch\` — no copy of the template per role,
- **data** — metrics, a time series and tickets, fetched only for the widgets the role can see and placed by selectors (\`stat\`, \`chart\`, \`table\`),
- **components** — a widget registry on Radix Themes (cards, a sparkline, a table); another frontend could render the same description with a different chart library.

The contract (above) has nothing in common with the content-site examples elsewhere in these docs — it's a separate instance (\`createDedal<DashboardContract>()\`) on the same engine. Rendered for \`{ role: 'admin', customer: 'acme' }\`.`,
    run: run(roleDashboard, { role: 'admin', customer: 'acme' }),
  },
  {
    slug: 'dashboard-customer-layout',
    title: 'Per customer: a layout saved as JSON',
    level: 'warning',
    files,
    registry,
    description: `Many dashboards let users arrange their own: drag a widget up, make a chart wider, hide a number. That arrangement is structure — and it belongs in storage, not in code.

Here the customer "acme" saved version 7 of their layout: tickets first, the chart across the full width, two numbers instead of four. The page reads the saved layout on every build (\`sections\` is async), checks it against the dashboard's contract — an unknown widget or a column count the contract doesn't allow fails with its path — and is cached per customer and role, invalidated when the customer saves. The same pattern as step 4 of the *Tutorial*, in a different domain.

The data loader is the same for every customer and knows nothing about the layout: the four metrics go to the two \`stat\` places in order, and the other two are skipped (\`onSurplus: 'ignore'\` — the yellow warning in devtools says how many). If "acme" adds a third number tomorrow, it fills in without any code change.`,
    run: run(customerDashboard, { role: 'admin', customer: 'acme' }),
  },
  {
    slug: 'dashboard-missing',
    title: 'A widget whose data source is down',
    level: 'error',
    files,
    registry,
    description: `Dashboards pull from many sources, and one of them is always having a bad day. The incidents row has its own loader marked \`optional: true\`: when the status API answers 503, the row disappears, the error goes to \`onSectionError\` (logs, alerts), and the rest of the dashboard renders.

Without \`optional\` the whole build would fail — the right choice for a widget without which the dashboard makes no sense. The rules for missing data are the same in every domain: decide per section what "missing" means.`,
    run: run(withIncidents, { role: 'admin', customer: 'acme' }),
  },
]
