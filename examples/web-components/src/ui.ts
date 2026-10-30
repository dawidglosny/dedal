import { createDedal, type ToPropsInput } from 'dedal'
import type { Article } from './api'
import type { Contract } from './contract'

export const ui = createDedal<Contract>({
  toProps: {
    card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
      data ? { ...props, heading: data.headline, href: `/articles/${data.slug}` } : props,
    badge: ({ props, data }: ToPropsInput<Contract, 'badge', string>) => (data ? { ...props, label: data } : props),
  },
})
