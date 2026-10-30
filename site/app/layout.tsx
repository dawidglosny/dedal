import '@radix-ui/themes/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: { default: 'Dedal — server-driven UI for TypeScript', template: '%s — Dedal' },
  description: 'Store page layouts as data on the server, fill them with content, let any frontend render them with its own components.',
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
