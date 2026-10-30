'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchEntry = { href: string; title: string; group: string; text: string }

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** Search over titles and text of every docs page; the index is a static JSON file loaded on first focus. */
export function Search() {
  const [index, setIndex] = useState<SearchEntry[]>()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = () => {
    if (!index) fetch(`${base}/search-index.json`).then(response => response.json()).then(setIndex)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!index || !words.length) return []
    return index
      .map(entry => {
        const title = entry.title.toLowerCase()
        const text = entry.text.toLowerCase()
        if (!words.every(word => title.includes(word) || text.includes(word))) return undefined
        const score = words.reduce((sum, word) => sum + (title.includes(word) ? 10 : 0), 0)
        const at = text.indexOf(words[0])
        const snippet = at === -1 ? entry.text.slice(0, 110) : `${at > 40 ? '…' : ''}${entry.text.slice(Math.max(0, at - 40), at + 80)}…`
        return { ...entry, score, snippet }
      })
      .filter(result => result !== undefined)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [index, query])

  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        placeholder="Search docs  /"
        value={query}
        onFocus={() => {
          load()
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={event => setQuery(event.target.value)}
      />
      {open && query && (
        <ul className="search-results">
          {results.length === 0 && <li className="search-empty">{index ? 'Nothing found' : 'Loading…'}</li>}
          {results.map(result => (
            <li key={result.href}>
              <Link href={result.href} onClick={() => setQuery('')}>
                <span className="search-title">{result.title}</span>
                <span className="search-group">{result.group}</span>
                <span className="search-snippet">{result.snippet}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
