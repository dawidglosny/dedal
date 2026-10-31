import { createDedal } from 'dedal'
import { dashboardContract } from './contract'

/** A second instance, for a second contract — nothing is shared with the content-site instance. */
export const dash = createDedal({
  contract: dashboardContract,
  defaults: { board: { columns: 4 }, panel: { span: 1 } },
})
