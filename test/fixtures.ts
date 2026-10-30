import { createDedal, type Slot } from '../src'

/** Test component contract (mock) — containers, cards, heading, image, profile, tabs and slots. */
export type TestComponents = {
  'container': { tone?: string }
  'grid': { columns?: number; span?: number; alignSelf?: 'start' | 'center' | 'end' }
  'stack': { gap?: string; style?: Record<string, string> }
  card: { size?: 'small' | 'medium' | 'large'; variant?: 'vertical' | 'horizontal' | 'overlay'; testId?: string }
  'heading': { size?: string; divider?: boolean; title?: string; actions?: Slot }
  'image': {
    size?: string
    width?: string
    sources?: { minWidth: number; size: string }[]
  }
  'profile': { size?: 'small' | 'medium'; cover?: Slot }
  tabs: { labels?: string[]; content?: Slot[] }
}

export const ui = createDedal<TestComponents>({
  defaults: {
    card: { size: 'medium', variant: 'vertical', testId: 'article' },
    'heading': { size: 'medium', divider: false },
    'image': {
      size: 'auto',
      sources: [
        { minWidth: 400, size: 'sm' },
        { minWidth: 768, size: 'md' },
      ],
    },
  },
})

export const { node, repeat, clone } = ui
