'use client'

import { useDocsSearch } from 'fumadocs-core/search/client'
import { staticClient } from 'fumadocs-core/search/client/orama-static'
import type { SharedProps } from 'fumadocs-ui/contexts/search'
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from 'fumadocs-ui/components/dialog/search'

// the index is a static file (app/search.json), downloaded on first use and searched in the browser
const client = staticClient({ from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/search.json` })

/** The docs search dialog (Ctrl/⌘ K): static search, no server needed — works on GitHub Pages. */
export default function DocsSearchDialog(props: SharedProps) {
  const search = useDocsSearch({ client })
  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  )
}
