import './shadcn.css'
import type { ReactNode } from 'react'

export const metadata = { title: 'Dedal × shadcn/ui' }

/** Separate root layout: Tailwind (with preflight) loads only on the shadcn routes. */
export default function ShadcnLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
