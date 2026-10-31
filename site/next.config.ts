import { join } from 'node:path'
import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

// a static site (GitHub Pages): every docs page and every case is built once, at build time
const basePath = process.env.PAGES_BASE_PATH ?? ''

const config: NextConfig = {
  output: 'export',
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  images: { unoptimized: true },
  // the repository root: the docs include files from outside site/ (docs/API.md, the examples' code)
  turbopack: { root: join(import.meta.dirname, '..') },
  outputFileTracingRoot: join(import.meta.dirname, '..'),
}

// fumadocs-mdx: compiles content/docs/*.mdx (configured in source.config.ts) into the `.source` collections
const withMDX = createMDX()

export default withMDX(config)
