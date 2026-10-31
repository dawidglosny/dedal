import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { Devtools } from 'dedal/react/devtools'
import { baseOptions } from '@/lib/layout'
import { source } from '@/lib/source'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions} links={baseOptions.links?.filter(link => 'text' in link && link.text !== 'Docs')}>
      {children}
      {/* the devtools panel reads the payloads of the case pages (<DevtoolsData>) */}
      <Devtools />
    </DocsLayout>
  )
}
