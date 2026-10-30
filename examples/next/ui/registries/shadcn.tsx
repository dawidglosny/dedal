import type { Registry } from 'dedal/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { Contract } from '../contract'
import { coverStyle, initials } from '../cover'

// full class names in code — Tailwind detects them statically
const width = { sm: 'max-w-2xl', md: 'max-w-4xl', lg: 'max-w-6xl' } as const
const columns = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const
const gap = { sm: 'gap-3', md: 'gap-6', lg: 'gap-8' } as const
const ratio = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square' } as const
const align = { start: 'items-start', center: 'items-center', end: 'items-end' } as const

/**
 * shadcn/ui registry: components from `components/ui` (code in the project) + Tailwind.
 * The contract says “what”, this file — “how” in shadcn's language.
 */
export const shadcn = {
  container: ({ size = 'lg', children }) => <div className={cn('mx-auto w-full px-4', width[size])}>{children}</div>,

  section: ({ title, description, children }) => (
    <section className="py-8">
      {(title || description) && (
        <div className="mb-6 space-y-1">
          {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  ),

  grid: ({ columns: count = 3, gap: space = 'md', children }) => (
    <div className={cn('grid', columns[count], gap[space])}>{children}</div>
  ),

  flex: ({ direction = 'row', gap: space = 'md', align: alignment = 'center', children }) => (
    <div className={cn('flex', direction === 'column' && 'flex-col', gap[space], align[alignment])}>{children}</div>
  ),

  hero: ({ title, description, href, media, actions }) => (
    <Card className="gap-0 overflow-hidden py-0 md:grid md:grid-cols-2">
      <div>{media}</div>
      <div className="flex flex-col justify-center gap-4 p-8">
        <h1 className="text-4xl font-bold tracking-tight">
          <a href={href} className="hover:underline">
            {title}
          </a>
        </h1>
        {description && <p className="text-muted-foreground text-lg">{description}</p>}
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </Card>
  ),

  card: ({ title, href, description, image, size = 'md', badge, footer }) => (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', image && size !== 'sm' && 'pt-0', size === 'lg' && 'col-span-2')}>
      {image && size !== 'sm' && <div className={ratio['4:3']} style={coverStyle(image)} />}
      <CardHeader>
        <CardTitle className={cn(size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg')}>
          <a href={href} className="hover:underline">
            {title}
          </a>
        </CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
        {description && size !== 'sm' && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  ),

  badge: ({ label, variant = 'default' }) => <Badge variant={variant}>{label}</Badge>,

  avatar: ({ name, src }) => (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="text-muted-foreground text-sm">{name}</span>
    </div>
  ),

  button: ({ label, href, variant = 'default' }) =>
    href ? (
      <Button asChild variant={variant}>
        <a href={href}>{label}</a>
      </Button>
    ) : (
      <Button variant={variant}>{label}</Button>
    ),

  image: ({ src, alt, ratio: r = '16:9' }) => (
    <div role="img" aria-label={alt} className={cn('size-full min-h-48', ratio[r])} style={coverStyle(src)} />
  ),

  tabs: ({ labels, content = [] }) => (
    <Tabs defaultValue={labels[0]}>
      <TabsList>
        {labels.map(label => (
          <TabsTrigger key={label} value={label}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {labels.map((label, index) => (
        <TabsContent key={label} value={label}>
          {content[index]}
        </TabsContent>
      ))}
    </Tabs>
  ),

  list: ({ items = [] }) => (
    <ul className="divide-y">
      {items.map(item => (
        <li key={item.href} className="py-2">
          <a href={item.href} className="font-medium hover:underline">
            {item.title}
          </a>
          {item.meta && <span className="text-muted-foreground text-sm"> · {item.meta}</span>}
        </li>
      ))}
    </ul>
  ),

  separator: () => <Separator className="my-4" />,
} satisfies Registry<Contract>
