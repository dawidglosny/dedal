import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createDedal, type Slot } from '../src'
import { DevtoolsData, Render, renderNode, type Registry, type RenderProps } from '../src/react'

type Contract = {
  grid: { columns?: number }
  card: { title: string; href?: string }
  hero: { title?: string; media?: Slot }
  tabs: { labels?: string[]; content?: Slot[] }
  image: { src?: string }
  text: { children?: string }
}

const ui = createDedal<Contract>()
const { node, repeat, section } = ui

const registry = {
  grid: ({ columns, children }) => <div data-columns={columns}>{children}</div>,
  card: ({ title, href }) => <a href={href}>{title}</a>,
  hero: ({ title, media }) => (
    <header>
      {media}
      <h1>{title}</h1>
    </header>
  ),
  tabs: ({ labels = [], content = [] }) => (
    <section>
      {labels.map((label, i) => (
        <div key={label}>
          <b>{label}</b>
          {content[i]}
        </div>
      ))}
    </section>
  ),
  image: ({ src }) => <figure data-src={src} />,
  text: ({ children }) => <p>{children}</p>,
} satisfies Registry<Contract>

const html = (element: ReactNode) => renderToStaticMarkup(<>{element}</>)

describe('Render', () => {
  it('renders a page from resolve(): sections in order, slots as props, child nodes as children', async () => {
    const home = ui.page({
      sections: [
        section('top', node('hero', { slots: { media: node('image') } })),
        section('news', node('grid', { props: { columns: 2 }, children: [repeat(node('card'), 2)] })),
      ],
      data: () => ({
        top: { hero: [{ title: 'Hero' }], image: [{ src: 'h.webp' }] },
        news: { card: [{ title: 'A', href: '/a' }, { title: 'B', href: '/b' }] },
      }),
    })

    const resolved = ui.resolve(await home.build())

    expect(html(<Render tree={resolved} registry={registry} />)).toBe(
      '<header><figure data-src="h.webp"></figure><h1>Hero</h1></header>' +
        '<div data-columns="2"><a href="/a">A</a><a href="/b">B</a></div>'
    )
  })

  it('a slot list reaches the component as an array of elements', () => {
    const root = ui.layout(
      node('tabs', { props: { labels: ['X', 'Y'] }, slots: { content: [node('text'), node('text')] } }),
      't'
    )
    const { tree } = ui.resolveTree(root, { 't:content.0': { children: 'first' }, 't:content.1': { children: 'second' } })

    expect(html(<Render tree={tree} registry={registry} />)).toBe(
      '<section><div><b>X</b><p>first</p></div><div><b>Y</b><p>second</p></div></section>'
    )
  })

  it('the children prop from the contract stays when the node has no children in the layout', () => {
    const { tree } = ui.resolveTree(ui.layout(node('text', { props: { children: 'text' } }), 'x'))

    expect(html(<Render tree={tree} registry={registry} />)).toBe('<p>text</p>')
  })

  it('unknown component: nothing by default, the fallback when given', () => {
    const tree = { key: 'x', component: 'video' } as never
    const partial: Partial<Registry<Contract>> = { card: registry.card }

    expect(html(<Render tree={tree} registry={partial} />)).toBe('')
    expect(
      html(
        <Render
          tree={tree}
          registry={partial}
          fallback={({ component, nodeKey }) => <i data-missing={component} data-key={nodeKey} />}
        />
      )
    ).toBe('<i data-missing="video" data-key="x"></i>')
  })

  it('sets key from the node ID', () => {
    const { tree } = ui.resolveTree(ui.layout(node('grid', { children: [node('card')] }), 'k'), {
      'k.0': { title: 'A' },
    })

    expect(renderNode(tree, { registry })!.key).toBe('k')
  })
})

describe('Render: deferred sections', () => {
  const home = ui.page({
    sections: [
      section('top', node('text', { props: { children: 'top' } })),
      section('forYou', node('card'), {
        defer: { fallback: node('text', { props: { children: 'loading…' } }) },
        data: () => ({ card: [{ title: 'For you' }] }),
      }),
    ],
  })

  it('renders the fallback by default', async () => {
    const resolved = ui.resolve(await home.build())

    expect(html(<Render tree={resolved} registry={registry} />)).toBe('<p>top</p><p>loading…</p>')
  })

  it('deferred receives the section key and the fallback (e.g. for <Suspense>)', async () => {
    const resolved = ui.resolve(await home.build())
    const section = ui.resolve(await home.section('forYou'))

    const rendered = html(
      <Render
        tree={resolved}
        registry={registry}
        deferred={({ sectionKey, fallback }) => (
          <div data-section={sectionKey}>
            {fallback}
            <Render tree={section} registry={registry} />
          </div>
        )}
      />
    )

    expect(rendered).toBe('<p>top</p><div data-section="forYou"><p>loading…</p><a>For you</a></div>')
  })
})

describe('Render debug', () => {
  it('wraps every node (slots included) in a marker element with its key', () => {
    const { tree } = ui.resolveTree(ui.layout(node('hero', { props: { title: 'H' }, slots: { media: node('image') } }), 'h'))

    expect(html(<Render tree={tree} registry={registry} debug />)).toBe(
      '<dedal-node data-dedal-key="h" style="display:contents"><header>' +
        '<dedal-node data-dedal-key="h:media" style="display:contents"><figure></figure></dedal-node>' +
        '<h1>H</h1></header></dedal-node>'
    )
  })

  it('without debug the DOM is unchanged', () => {
    const { tree } = ui.resolveTree(ui.layout(node('image'), 'i'))

    expect(html(<Render tree={tree} registry={registry} />)).toBe('<figure></figure>')
  })
})

describe('DevtoolsData', () => {
  it('embeds the payload as JSON whose data cannot close the script', () => {
    const payload = { evil: '</script><script>alert(1)</script>', comment: '<!--' }
    const markup = html(<DevtoolsData payload={payload} />)

    expect(markup).not.toContain('</script><script>')
    expect(markup.startsWith('<script type="application/json" data-dedal-devtools="">')).toBe(true)

    const json = markup.slice(markup.indexOf('>') + 1, markup.lastIndexOf('</script>'))
    expect(JSON.parse(json)).toEqual(payload)
  })
})

describe('Registry types', () => {
  it('requires all components and checks props', () => {
    // @ts-expect-error — no "text" component
    const missing: Registry<Contract> = { ...registry, text: undefined }
    // @ts-expect-error — the component requires a prop outside the contract
    const wrongProps: Registry<Contract> = { ...registry, card: ({ subtitle }: { subtitle: string }) => <a>{subtitle}</a> }
    const slotProps: RenderProps<Contract, 'tabs'> = { labels: [], content: [<p key="a" />] }

    expect([missing, wrongProps, slotProps]).toHaveLength(3)
  })
})
