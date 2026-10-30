import '@radix-ui/themes/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: { default: 'Dedal — server-driven UI for TypeScript', template: '%s — Dedal' },
  description: 'Structure, data and components — kept apart, joined at the last moment. A server-driven UI engine for TypeScript.',
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
