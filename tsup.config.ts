import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.tsx',
    // client component — esbuild keeps the 'use client' directive from the entry file
    'react/devtools': 'src/react/devtools.ts',
    'devtools/index': 'src/devtools/index.ts',
    'devtools/panel': 'src/devtools/panel.ts',
    'figma/index': 'src/figma/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  external: ['react'],
})
