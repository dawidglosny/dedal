'use client'

import { useEffect } from 'react'

/**
 * Mounts the devtools panel (`mountDevtools()` from `dedal/devtools/panel`) — a client component for Next / RSC.
 * Render only in debug mode (the app's decision); the panel code is loaded dynamically, only after mounting.
 * Without `open` the panel is open or closed as it was left in this browser tab; `open` forces it.
 *
 * @example
 * ```tsx
 * {debug && <Devtools />}
 * ```
 */
export function Devtools({ open }: { open?: boolean }): null {
  useEffect(() => {
    let dispose: (() => void) | undefined
    let cancelled = false

    void import('../devtools/panel').then(({ mountDevtools }) => {
      if (!cancelled) dispose = mountDevtools({ open })
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [open])

  return null
}
