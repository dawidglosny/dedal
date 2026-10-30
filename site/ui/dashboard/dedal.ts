import { createDedal } from 'dedal'
import type { DashboardContract } from './contract'

/** A second instance, for a second contract — nothing is shared with the content-site instance. */
export const dash = createDedal<DashboardContract>({
  defaults: { board: { columns: 4 }, panel: { span: 1 } },
})
