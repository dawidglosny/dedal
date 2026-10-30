import type { NextConfig } from 'next'

// a static site (GitHub Pages): every docs page and every case is built once, at build time
const basePath = process.env.PAGES_BASE_PATH ?? ''

const config: NextConfig = {
  output: 'export',
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
}

export default config
