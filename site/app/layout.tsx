import './global.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import DocsSearchDialog from '@/components/search-dialog'

export const metadata: Metadata = {
  title: { default: 'Dedal — server-driven UI for TypeScript', template: '%s — Dedal' },
  description: 'Change screens without changing code. The engine behind pages generated from Figma or a page builder, rendered with your own design system.',
}

/** One root for the home page and the docs: Fumadocs' provider (theme, search), so moving between them is client-side. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog: DocsSearchDialog }}>{children}</RootProvider>
      </body>
    </html>
  )
}
