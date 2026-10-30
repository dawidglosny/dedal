import '@radix-ui/themes/styles.css'
import { Theme } from '@radix-ui/themes'
import type { ReactNode } from 'react'

export const metadata = { title: 'Dedal × Radix Themes' }

/** Separate root layout: Radix Themes styles don't mix with Tailwind from the /shadcn route. */
export default function RadixLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body style={{ margin: 0 }}>
        <Theme accentColor="indigo" grayColor="slate" radius="medium">
          {children}
        </Theme>
      </body>
    </html>
  )
}
