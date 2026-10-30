import '@radix-ui/themes/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: { default: 'Dedal — server-driven UI for TypeScript', template: '%s — Dedal' },
  description: 'Let editors, designers and experiments change page layouts without a frontend release — a server-driven UI engine for TypeScript.',
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
