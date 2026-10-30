import type { ToProps, ToPropsInput } from 'dedal'
import type { Article, Author } from '@/content/articles'
import type { Contract } from './contract'

const href = (article: Article) => `/artykul/${article.slug}`

/**
 * Mappings from data (API shape) to contract props. A pure module without IO — `resolve` can run on the server
 * or the front end. Knows nothing about Radix or shadcn: that's the registries' job.
 */
export const toProps: ToProps<Contract> = {
  hero: ({ props, data }: ToPropsInput<Contract, 'hero', Article>) =>
    data ? { ...props, title: data.headline, description: data.excerpt, href: href(data) } : props,

  card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
    data ? { ...props, title: data.headline, description: data.excerpt, href: href(data), image: data.cover } : props,

  image: ({ props, data }: ToPropsInput<Contract, 'image', Article>) =>
    data ? { ...props, src: data.cover, alt: data.headline } : props,

  // data is a plain string (category) — without a mapping resolve would report an issue
  badge: ({ props, data }: ToPropsInput<Contract, 'badge', string>) => (data ? { ...props, label: data } : props),

  avatar: ({ props, data }: ToPropsInput<Contract, 'avatar', Author>) => (data ? { ...props, name: data.name } : props),

  list: ({ props, data }: ToPropsInput<Contract, 'list', Article[]>) =>
    data ? { ...props, items: data.map(a => ({ title: a.headline, href: href(a), meta: a.category })) } : props,
}
