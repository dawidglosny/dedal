import Link from 'next/link'
import { LogoMark } from './logo'
import { Search } from './search'

export const GITHUB = 'https://github.com/dawidglosny/dedal'
export const VERSION = '0.7.0'

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">
          <LogoMark size={26} /> Dedal
        </Link>
        <span className="version">v{VERSION}</span>
        <nav className="header-nav">
          <Link href="/docs/">Docs</Link>
          <Link href="/docs/quick-start/">Quick start</Link>
          <Link href="/docs/tutorial/">Tutorial</Link>
          <Link href="/docs/api/">API</Link>
        </nav>
        <Search />
        <a className="header-github" href={GITHUB} aria-label="GitHub">
          GitHub
        </a>
      </div>
    </header>
  )
}
