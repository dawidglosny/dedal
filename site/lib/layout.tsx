import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { LogoMark } from '@/components/logo'
import { GITHUB, VERSION } from './site'

/** What the home page and the docs share: the title with the logo and the version, the top links, GitHub. */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <LogoMark size={22} /> Dedal <span className="text-xs font-normal text-fd-muted-foreground">v{VERSION}</span>
      </>
    ),
  },
  githubUrl: GITHUB,
  links: [
    { text: 'Docs', url: '/docs/', active: 'nested-url' },
    { text: 'Quick start', url: '/docs/quick-start/' },
    { text: 'Tutorial', url: '/docs/tutorial/' },
    { text: 'API', url: '/docs/api/' },
  ],
}
