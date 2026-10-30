import type { NextConfig } from 'next'

// the example lives inside the package repo — we point to its directory as root instead of guessing from lockfiles
const config: NextConfig = {
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
}

export default config
