import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { Devtools } from 'dedal/react/devtools'
import { GITHUB, VERSION } from '@/components/header'
import { LogoMark } from '@/components/logo'
import { source } from '@/lib/source'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      githubUrl={GITHUB}
      nav={{
        title: (
          <>
            <LogoMark size={22} /> Dedal <span className="text-xs font-normal text-fd-muted-foreground">v{VERSION}</span>
          </>
        ),
      }}
      links={[
        { text: 'Quick start', url: '/docs/quick-start/' },
        { text: 'Tutorial', url: '/docs/tutorial/' },
        { text: 'API', url: '/docs/api/' },
      ]}
    >
      {children}
      {/* the devtools panel reads the payloads of the case pages (<DevtoolsData>) */}
      <Devtools />
    </DocsLayout>
  )
}
