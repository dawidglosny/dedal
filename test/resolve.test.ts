import { describe, expect, it, vi } from 'vitest'
import { createDedal, resolve, resolveTree, type PageResult, type Slot, type ToProps, type ToPropsInput } from '../src'

type Contract = {
  grid: { columns?: number }
  card: { title?: string; href?: string; size?: 'sm' | 'md' | 'lg'; meta?: { author?: string; date?: string } }
  hero: { title?: string; media?: Slot }
  image: { src?: string; alt?: string }
  label: { text?: string }
}

type Article = { headline: string; url: string }
type Ctx = { device: 'desktop' | 'mobile' }

/** Mappings as a separate, pure module next to the contract. */
const toProps: ToProps<Contract> = {
  card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
    data ? { ...props, title: data.headline, href: data.url } : props,
  label: ({ props, ctx }: ToPropsInput<Contract, 'label', unknown, Ctx>) => ({
    ...props,
    text: ctx.device === 'mobile' ? 'M' : 'D',
  }),
}

const ui = createDedal<Contract>({ defaults: { card: { size: 'md' } }, toProps })
const { node, repeat, section } = ui

const root = ui.layout(
  node('grid', {
    props: { columns: 3 },
    children: [
      node('hero', { alias: 'top', slots: { media: node('image', { props: { alt: 'cover' } }) } }),
      repeat(node('card'), 2),
    ],
  }),
  'n'
)

describe('resolveTree', () => {
  it('builds the tree: key = ID, slots and children recursively, no aliases', () => {
    const { tree, issues } = ui.resolveTree(root, {
      'n.0': { title: 'Hero' },
      'n.0:media': { src: 'a.webp' },
    })

    expect(issues).toEqual([])
    expect(tree).toEqual({
      key: 'n',
      component: 'grid',
      props: { columns: 3 },
      children: [
        {
          key: 'n.0',
          component: 'hero',
          props: { title: 'Hero' },
          slots: { media: { key: 'n.0:media', component: 'image', props: { alt: 'cover', src: 'a.webp' } } },
        },
        { key: 'n.1', component: 'card', props: { size: 'md' } },
        { key: 'n.2', component: 'card', props: { size: 'md' } },
      ],
    })
  })

  it('without a mapping: data deep-merged with the layout props, data wins', () => {
    const plain = createDedal<Contract>()
    const cardRoot = plain.layout(plain.node('card', { props: { size: 'sm', meta: { author: 'A', date: '1' } } }), 'c')

    expect(plain.resolveTree(cardRoot, { c: { size: 'lg', meta: { date: '2' } } }).tree.props).toEqual({
      size: 'lg',
      meta: { author: 'A', date: '2' },
    })
  })

  it('a mapping turns data into contract props', () => {
    const { tree } = ui.resolveTree(root, { 'n.1': { headline: 'Title', url: '/a' } })

    expect(tree.children![1].props).toEqual({ size: 'md', title: 'Title', href: '/a' })
    expect(tree.children![2].props).toEqual({ size: 'md' })
  })

  it('a mapping receives node and ctx, even without data', () => {
    const spy = vi.fn(({ props }: ToPropsInput<Contract, 'label'>) => props)
    const labelRoot = ui.layout(node('label'), 'l')

    resolveTree(labelRoot, {}, { toProps: { label: spy }, ctx: { device: 'mobile' } })

    expect(spy).toHaveBeenCalledWith({ props: {}, data: undefined, node: labelRoot, ctx: { device: 'mobile' } })
    expect(ui.resolveTree(labelRoot, {}, { ctx: { device: 'mobile' } }).tree.props).toEqual({ text: 'M' })
  })

  it('trace: the source of every prop', () => {
    const { tree } = ui.resolveTree(root, { 'n.1': { headline: 'Title', url: '/a' } }, { trace: true })

    // layout without trace — source in the layout unknown
    expect(tree.trace).toEqual({ columns: { from: 'layout' } })
    expect(tree.children![1].trace).toEqual({ size: { from: 'layout' }, title: { from: 'data' }, href: { from: 'data' } })
  })

  it('without trace no trace field is added', () => {
    expect(ui.resolveTree(root).tree).not.toHaveProperty('trace')
  })

  it('does not mutate the layout or data', () => {
    const data = { 'n.0': { title: 'Hero' } }
    const snapshot = JSON.parse(JSON.stringify({ root, data }))

    ui.resolveTree(root, data, { trace: true })

    expect({ root, data }).toEqual(snapshot)
  })
})

describe('resolveTree: issues', () => {
  const plain = createDedal<Contract>()
  const cardRoot = plain.layout(plain.node('card', { props: { size: 'sm' } }), 'c')

  it('non-object data without a mapping → issue, props from the layout', () => {
    const { tree, issues } = plain.resolveTree(cardRoot, { c: 'text' })

    expect(tree.props).toEqual({ size: 'sm' })
    expect(issues).toEqual([{ id: 'c', message: expect.stringContaining('add toProps') }])
  })

  it('an exception in a mapping → issue, props from the layout', () => {
    const { tree, issues } = resolveTree(cardRoot, {}, {
      toProps: {
        card: () => {
          throw new Error('boom')
        },
      },
    })

    expect(tree.props).toEqual({ size: 'sm' })
    expect(issues[0].message).toContain('boom')
  })

  it('a mapping returning a non-object → issue', () => {
    const { issues } = resolveTree(cardRoot, {}, { toProps: { card: () => null as never } })

    expect(issues[0].message).toContain('must return an object')
  })

  it("onIssue: 'throw' aborts", () => {
    expect(() => plain.resolveTree(cardRoot, { c: 1 }, { onIssue: 'throw' })).toThrow('resolve: c:')
  })
})

describe('resolve: page', () => {
  const home = ui.page<Ctx>({
    sections: ({ device }) => [
      section('top', node('hero', { slots: { media: node('image') } })),
      section('news', node('grid', { props: { columns: device === 'mobile' ? 1 : 3 }, children: [repeat(node('card'), 3)] })),
      section('footer', node('label')),
    ],
    data: () => ({
      top: { hero: [{ title: 'Hero' }], image: [{ src: 'h.webp' }] },
      news: { card: [{ headline: 'A', url: '/a' }, { headline: 'B', url: '/b' }] },
    }),
  })

  it('build → resolve end-to-end', async () => {
    const ctx: Ctx = { device: 'mobile' }
    const resolved = ui.resolve(await home.build(ctx), { ctx })

    expect(resolved.dedal).toBe(1)
    expect(resolved.issues).toEqual([])
    expect(resolved.sections.map(s => s.key)).toEqual(['top', 'news', 'footer'])

    const [top, news, footer] = resolved.sections.map(s => s.tree)
    expect(top.props).toEqual({ title: 'Hero' })
    expect(top.slots!.media).toEqual({ key: 'top:media', component: 'image', props: { src: 'h.webp' } })
    expect(news.props).toEqual({ columns: 1 })
    expect(news.children!.map(card => card.props)).toEqual([
      { size: 'md', title: 'A', href: '/a' },
      { size: 'md', title: 'B', href: '/b' },
    ])
    expect(footer.props).toEqual({ text: 'M' })
  })

  it('the result goes through JSON (resolve on the other side of the network)', async () => {
    const ctx: Ctx = { device: 'desktop' }
    const wire = JSON.parse(JSON.stringify(await home.build(ctx)))
    const resolved = ui.resolve(wire, { ctx })

    expect(JSON.parse(JSON.stringify(resolved))).toEqual(resolved)
    expect(resolved).toEqual(ui.resolve(await home.build(ctx), { ctx }))
  })

  it('reports data without a node (e.g. a cached layout out of sync with the data)', async () => {
    const result = await home.build({ device: 'desktop' })
    const stale = { ...result, data: { ...result.data, 'news.0.7': { headline: 'X', url: '/x' } } }

    expect(ui.resolve(stale, { ctx: { device: 'desktop' } }).issues).toEqual([
      { id: 'news.0.7', message: expect.stringContaining('has no node in the layout') },
    ])
  })

  it('rejects an unknown format version', () => {
    const future = { dedal: 2, sections: [], data: {}, report: {} } as unknown as PageResult<Contract>

    expect(() => resolve(future)).toThrow('unsupported format version 2')
  })
})

describe('toProps types', () => {
  it('the mapping result is checked against the contract', () => {
    const ok: ToProps<Contract> = { card: ({ props }) => ({ ...props, size: 'lg' }) }
    // @ts-expect-error — disallowed size value
    const badValue: ToProps<Contract> = { card: () => ({ size: 'huge' }) }
    // @ts-expect-error — unknown component
    const badName: ToProps<Contract> = { unknown: () => ({}) }

    expect([ok, badValue, badName]).toHaveLength(3)
  })
})
