import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

// MDX docs pages: one file per page in content/docs; the sidebar order (meta) comes from lib/source.ts
export const docs = defineDocs({ dir: 'content/docs' })

export default defineConfig()
