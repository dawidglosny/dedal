import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render } from 'dedal/react'
import { Devtools } from 'dedal/react/devtools'
import { homePage, ui } from '@/ui/home'
import { registry } from '@/ui/registry'

/** Debug mode (`?debug=1`): props traced to their origin, the devtools panel mounted. */
export default async function Home({ searchParams }: { searchParams: Promise<{ debug?: string }> }) {
  const debug = (await searchParams).debug === '1'
  const page = await homePage()
  const result = await page.build(undefined, { trace: debug })
  const resolved = ui.resolve(result, { trace: debug })

  return (
    <>
      <Render tree={resolved} registry={registry} debug={debug} />
      <a
        href={debug ? '/' : '/?debug=1'}
        className="fixed bottom-4 left-4 z-30 rounded-full border bg-background px-3 py-1.5 font-mono text-xs shadow-sm hover:bg-muted"
      >
        {debug ? 'hide debug' : 'debug'}
      </a>
      {debug && (
        <>
          <DevtoolsData payload={inspect(result, resolved)} />
          <Devtools open />
        </>
      )}
    </>
  )
}
