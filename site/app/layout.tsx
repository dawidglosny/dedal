import '@radix-ui/themes/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: { default: 'Dedal — server-driven UI for TypeScript', template: '%s — Dedal' },
  description: 'Change screens without changing code. The engine behind pages generated from Figma or a page builder, rendered with your own design system.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
