import type { NextConfig } from 'next'

// the example lives inside the package repo — its own directory is the root
const config: NextConfig = {
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
}

export default config
