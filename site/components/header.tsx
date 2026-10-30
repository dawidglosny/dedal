import Link from 'next/link'
import { Search } from './search'

export const GITHUB = 'https://github.com/dawidglosny/dedal'
export const VERSION = '0.6.3'

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">◇</span> Dedal
        </Link>
        <span className="version">v{VERSION}</span>
        <nav className="header-nav">
          <Link href="/docs/">Docs</Link>
          <Link href="/docs/tutorial/">Tutorial</Link>
          <a href={`${GITHUB}/blob/main/docs/API.md`}>API</a>
        </nav>
        <Search />
        <a className="header-github" href={GITHUB} aria-label="GitHub">
          GitHub
        </a>
      </div>
    </header>
  )
}
