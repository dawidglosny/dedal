import Link from 'next/link'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { baseOptions } from '@/lib/layout'

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="font-mono text-sm text-fd-muted-foreground">404</p>
        <h1 className="text-3xl font-semibold">This page doesn’t exist</h1>
        <p className="text-fd-muted-foreground">It may have moved when the docs were reorganised. Search the docs (⌘K) or start from the beginning.</p>
        <div className="flex gap-3">
          <Link href="/docs/" className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground">
            The docs
          </Link>
          <Link href="/" className="rounded-md border px-4 py-2 text-sm font-medium">
            Home
          </Link>
        </div>
      </main>
    </HomeLayout>
  )
}
