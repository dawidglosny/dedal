import type { Ctx } from '@/ui/contract'
import { home } from '@/ui/home.page'

/**
 * The same page as JSON for another client (middleware → front topology): layout and data separately,
 * `resolve` + render on the client side.
 */
export async function GET(request: Request) {
  const device = new URL(request.url).searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop'
  const ctx: Ctx = { device }

  return Response.json(await home.build(ctx))
}
