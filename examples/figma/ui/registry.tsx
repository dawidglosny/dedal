import type { ReactNode } from 'react'
import type { InferContract } from 'dedal'
import type { Registry } from 'dedal/react'
import * as Icons from 'lucide-react'
import { ArrowRight, Check } from 'lucide-react'
import { Badge as ShadcnBadge } from '@/components/ui/badge'
import { Button as ShadcnButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { contract } from './contract.mjs'

export type Contract = InferContract<typeof contract>

/** Lucide icon by its kebab-case name — the name the Figma file's icon components use (`icon/pen-tool` → `pen-tool`). */
function Icon({ name, className }: { name?: string; className?: string }) {
  const key = (name ?? '').replace(/(^|-)(\w)/g, (_, __, char: string) => char.toUpperCase()) as keyof typeof Icons
  const Found = (Icons[key] ?? Icons.Square) as Icons.LucideIcon
  return <Found className={className} aria-hidden />
}

const toneOf = { default: 'bg-background', muted: 'bg-muted', dark: 'dark bg-blueprint text-blueprint-foreground' } as const

const Mark = () => (
  <span className="flex items-center gap-2 font-semibold">
    <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">D</span>
    Dedal
  </span>
)

/**
 * The registry: one React component per contract component, in the design system of the Figma file (shadcn/ui,
 * Geist, the file's colors). Slots arrive as props named after the slot; `children` are the block's children.
 */
export const registry = {
  section: ({ tone = 'default', children }) => (
    <section className={cn('px-6 py-24', toneOf[tone])}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-12">{children}</div>
    </section>
  ),

  navbar: ({ links, actions }) => (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-8 px-6 py-4">
        <Mark />
        <nav className="flex flex-1 items-center gap-1">{links}</nav>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  ),

  hero: ({ title, lead, install, badge, actions, media }) => (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      {badge}
      <h1 className="max-w-[960px] text-5xl font-semibold tracking-tight whitespace-pre-line md:text-6xl">{title}</h1>
      <p className="max-w-[720px] text-xl text-muted-foreground">{lead}</p>
      <div className="flex flex-wrap justify-center gap-3">{actions}</div>
      {install && <code className="rounded-md bg-muted px-4 py-2 font-mono text-sm">{install}</code>}
      {media && <div className="w-full pt-8">{media}</div>}
    </div>
  ),

  sectionHeading: ({ title, subtitle, align = 'center', tone = 'default', badge }) => (
    <div className={cn('flex max-w-[820px] flex-col gap-4', align === 'center' ? 'items-center text-center' : 'items-start')}>
      {badge}
      <h2 className="text-4xl font-semibold tracking-tight whitespace-pre-line">{title}</h2>
      {subtitle && <p className={cn('text-xl', tone === 'inverse' ? 'text-blueprint-foreground/75' : 'text-muted-foreground')}>{subtitle}</p>}
    </div>
  ),

  grid: ({ children }) => <div className="grid w-full gap-6 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">{children}</div>,

  split: ({ content, media }) => (
    <div className="grid w-full items-center gap-16 md:grid-cols-2">
      <div className="flex flex-col gap-6">{content}</div>
      <div>{media}</div>
    </div>
  ),

  image: ({ alt, src }) =>
    // until `npm run pull` downloads it, an image is a reference to Figma's storage: a placeholder
    src && !src.startsWith('figma-image:') ? (
      // eslint-disable-next-line @next/next/no-img-element -- plain static files from the pull
      <img src={src} alt={alt} className="w-full rounded-xl" />
    ) : (
      <div className="flex min-h-48 w-full items-center justify-center rounded-xl border border-dashed bg-muted p-6 text-sm text-muted-foreground">
        {alt} — run <code className="mx-1 font-mono">npm run pull</code> to download the image
      </div>
    ),

  step: ({ number, title, description }) => (
    <div className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">{number}</span>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
    </div>
  ),

  checkItem: ({ text, tone = 'default' }) => (
    <div className="flex items-center gap-2">
      <Check className={cn('size-4', tone === 'inverse' ? 'text-blueprint-foreground' : 'text-brand')} aria-hidden />
      <span>{text}</span>
    </div>
  ),

  codeBlock: ({ filename, code }) => (
    <figure className="overflow-hidden rounded-xl bg-blueprint text-blueprint-foreground">
      <figcaption className="border-b border-blueprint-line px-4 py-3 font-mono text-xs opacity-70">{filename}</figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  ),

  cta: ({ title, lead, actions }) => (
    <div className="flex w-full flex-col items-center gap-6 rounded-2xl border bg-brand-soft px-12 py-16 text-center">
      <h2 className="text-4xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-[720px] text-xl text-muted-foreground">{lead}</p>
      <div className="flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  ),

  footer: ({ tagline, links }) => (
    <footer className="border-t">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-8">
        <span className="flex items-center gap-4">
          <Mark />
          <span className="text-sm text-muted-foreground">{tagline}</span>
        </span>
        <nav className="flex gap-6">{links}</nav>
      </div>
    </footer>
  ),

  link: ({ label, href = '#' }) => (
    <a href={href} className="text-sm text-muted-foreground hover:text-foreground">
      {label}
    </a>
  ),

  text: ({ text, style }) => <TextBlock style={style}>{text}</TextBlock>,

  button: ({ label, variant = 'default', size = 'default', iconRight, href = '#' }) => (
    <ShadcnButton
      asChild
      variant={variant === 'brand' ? 'default' : variant}
      size={size}
      className={variant === 'brand' ? 'bg-brand text-white hover:bg-brand/90' : undefined}
    >
      <a href={href}>
        {label}
        {iconRight && <ArrowRight />}
      </a>
    </ShadcnButton>
  ),

  badge: ({ label, variant = 'default' }) => (
    <ShadcnBadge
      variant={variant === 'brand' || variant === 'accent' ? 'secondary' : variant}
      className={cn(variant === 'brand' && 'bg-brand-soft text-brand', variant === 'accent' && 'bg-accent-orange text-white')}
    >
      {label}
    </ShadcnBadge>
  ),

  feature: ({ title, description, icon }) => (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon name={icon} className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  ),
} satisfies Registry<Contract>

/** A loose text from Figma, styled by the name of its Figma text style (`h3`, `body-sm`) — the design system's type scale. */
function TextBlock({ style, children }: { style?: string; children: ReactNode }) {
  if (style === 'h2') return <h2 className="text-4xl font-semibold tracking-tight">{children}</h2>
  if (style === 'h3') return <h3 className="text-xl font-semibold">{children}</h3>
  if (style === 'lead') return <p className="text-xl text-muted-foreground">{children}</p>
  if (style === 'body-sm') return <p className="text-sm text-muted-foreground">{children}</p>
  return <p>{children}</p>
}
