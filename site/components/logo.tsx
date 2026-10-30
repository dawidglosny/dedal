/** The Dedal mark: a labyrinth "D" with the core in the middle (the full logo with its blueprint grid is logo.svg in the repository root). */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="52 52 316 316" fill="none" aria-hidden="true">
      <path d="M75 210V75H260L345 160V260L260 345H75V270" strokeWidth="30" stroke="var(--logo-line)" />
      <path d="M285 235L235 285H135V135H235L260 160" strokeWidth="30" stroke="var(--logo-line)" />
      <rect x="180" y="180" width="60" height="60" fill="var(--logo-core)" />
    </svg>
  )
}
