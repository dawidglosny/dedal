/**
 * dedal/figma on a real Figma file: "Dedal — landing", two versions of the page on two component libraries
 * (shadcn/ui and Radix Themes). The REST API response is trimmed by scripts/figma-fixture.mjs.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineContract } from '../src'
import { boolean, component, frame, layer, mapping, swap, text, variant, type FigmaNodesResponse } from '../src/figma'

const response = JSON.parse(readFileSync(new URL('./fixtures/figma-landing.json', import.meta.url), 'utf8')) as FigmaNodesResponse

// one contract per component library — each mirrors its library's components and values
const layout = { section: {}, group: {}, grid: {}, logo: {} } as const
const content = {
  hero: { props: z.object({ title: z.string(), lead: z.string().optional() }) },
  sectionHeading: { props: z.object({ title: z.string(), subtitle: z.string().optional() }) },
  feature: { props: z.object({ title: z.string(), description: z.string(), icon: z.string().optional() }) },
}

const shadcn = defineContract({
  ...layout,
  ...content,
  button: {
    props: z.object({
      label: z.string(),
      variant: z.enum(['default', 'secondary', 'outline', 'ghost', 'brand']).optional(),
      size: z.enum(['default', 'lg']).optional(),
      iconRight: z.boolean().optional(),
    }),
  },
  badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary', 'outline', 'brand', 'accent']).optional() }) },
})

const radix = defineContract({
  ...layout,
  ...content,
  button: {
    props: z.object({
      label: z.string(),
      variant: z.enum(['solid', 'soft', 'surface', 'outline', 'ghost']).optional(),
      color: z.enum(['accent', 'gray']).optional(),
      size: z.enum(['2', '3']).optional(),
      iconRight: z.boolean().optional(),
    }),
  },
  badge: { props: z.object({ label: z.string(), variant: z.enum(['soft', 'solid', 'surface', 'outline']).optional(), color: z.enum(['accent', 'orange', 'gray']).optional() }) },
  callout: { props: z.object({ text: z.string(), color: z.enum(['orange', 'accent']).optional() }) },
})

// the frames of this file that are components in the contract; the rest follows the convention
const frames = {
  feature: component('FeatureCard', { icon: swap('Icon', name => name.replace('icon/', '')) }),
  hero: frame('hero-copy'),
  sectionHeading: frame('section-heading'),
  grid: frame(/^(principle-grid|features-row)$/),
  group: frame(/^(nav|hero|cta)-actions$|^nav-links$/),
}
// decorative mock-ups of the landing page: illustrations, not content
const ignore = ['pipeline', 'figma-frame-mock', 'devtools-panel-mock']

describe('dedal/figma — the shadcn/ui version', () => {
  const fromFigma = mapping(shadcn, frames, { section: 'section', ignore })

  it('every section converts and matches the contract', async () => {
    const result = await fromFigma.convert(response, '5:2')
    expect(result.errors).toEqual([])
    expect(Object.keys(result.sections)).toEqual(['nav', 'hero', 'principle', 'showcase', 'features', 'devtools', 'contract', 'cta', 'footer'])
  })

  it('component properties by convention, text layers of a mapped frame, a swapped icon', async () => {
    const { sections } = await fromFigma.convert(response, '5:2')
    expect(sections.hero).toEqual({
      component: 'hero',
      props: { title: 'Design the page in Figma.\nShip it without a release.', lead: expect.stringContaining('Dedal turns a Figma frame') },
      children: [
        { component: 'badge', props: { label: 'v0.6.6 · TypeScript · zero dependencies', variant: 'brand' } },
        {
          component: 'group',
          children: [
            { component: 'button', props: { label: 'Get started', variant: 'default', size: 'lg', iconRight: true } },
            { component: 'button', props: { label: 'Watch the 60-second demo', variant: 'outline', size: 'lg', iconRight: false } },
          ],
        },
      ],
    })
    const principle = sections.principle as { component: string; children: { component: string; children?: { props?: unknown }[] }[] }
    expect(principle.component).toBe('section') // an unmapped section frame with several blocks → the section container
    expect(principle.children.map(child => child.component)).toEqual(['sectionHeading', 'grid'])
    expect(principle.children[1].children?.map(card => card.props)).toEqual([
      expect.objectContaining({ title: 'Structure', icon: 'pen-tool' }),
      expect.objectContaining({ icon: 'database' }),
      expect.objectContaining({ icon: 'component' }),
    ])
  })

  it('what didn\'t become part of the template is reported with its path — nothing is dropped silently', async () => {
    const { unmapped } = await fromFigma.convert(response, '5:2')
    expect(unmapped).toContainEqual({ path: 'cta/cta-panel/title', reason: expect.stringContaining('text layer') })
    expect(unmapped).toContainEqual({ path: 'devtools/devtools-row/devtools-copy/bullet[0]/icon/check', reason: expect.stringContaining('"icon/check"') })
    // a mock-up skipped through the ignore option: one entry, nothing from inside it
    expect(unmapped).toContainEqual({ path: 'hero/pipeline', reason: expect.stringContaining('ignored') })
    expect(unmapped.filter(({ path }) => path.startsWith('hero/pipeline/'))).toEqual([])
  })

  it('a contract that doesn\'t match the design fails with the template path', async () => {
    const strict = defineContract({ ...shadcn, badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary', 'outline']).optional() }) } })
    const result = await mapping(strict, frames, { section: 'section', ignore }).convert(response, '5:2')
    expect(result.ok).toBe(false)
    // the template path, and the Figma layer the block came from
    expect(result.errors).toContainEqual({ path: 'hero.children[0].props.variant', figma: 'hero/hero-copy/Badge', message: expect.any(String) })
  })
})

describe('dedal/figma — the Radix version, with its own contract', () => {
  const fromFigma = mapping(radix, frames, { section: 'section', ignore, componentName: name => name.replace(/ \(Radix\)$/, '') })

  it('converts with Radix\'s own values — not translated to another library\'s', async () => {
    const result = await fromFigma.convert(response, '14:198')
    expect(result.errors).toEqual([])
    const nav = result.sections.nav as { children: { component: string; children?: { props?: unknown }[] }[] }
    expect(nav.children[0]).toEqual({ component: 'logo' }) // "Logo (Radix)" through the name rule
    expect(nav.children[1].children?.[0]).toEqual({ component: 'button', props: { label: 'Docs', variant: 'ghost', color: 'gray', size: '2', iconRight: false } })
    // the mock devtools panel is ignored — its badges and callout don't leak into the section
    expect(result.sections.devtools).toEqual({ component: 'badge', props: { label: 'Devtools', variant: 'solid', color: 'orange' } })
  })
})

describe('dedal/figma — the mapping', () => {
  // a small file: one frame with a hidden button and a card
  const file: FigmaNodesResponse = {
    nodes: {
      '1:1': {
        document: {
          id: '1:1', name: 'page', type: 'FRAME',
          children: [
            {
              id: '1:2', name: 'promo', type: 'FRAME',
              children: [
                { id: '1:3', name: 'heading', type: 'TEXT', characters: 'Sale' },
                { id: '1:4', name: 'Button', type: 'INSTANCE', componentId: 'b', componentProperties: { 'Text#1:0': { type: 'TEXT', value: 'Buy' }, Kind: { type: 'VARIANT', value: 'Primary' }, 'Wide#1:1': { type: 'BOOLEAN', value: true } } },
                { id: '1:5', name: 'Button', type: 'INSTANCE', visible: false, componentId: 'b', componentProperties: {} },
              ],
            },
          ],
        },
        components: { b: { name: 'Kind=Primary', componentSetId: 'bs' } },
        componentSets: { bs: { name: 'Action' } },
      },
    },
  }
  const contract = defineContract({
    promo: { props: z.object({ title: z.string() }) },
    button: { props: z.object({ label: z.string(), kind: z.enum(['primary', 'secondary']), block: z.boolean().optional() }) },
  })

  it('explicit sources: text, variant with a value map, boolean, a text layer; hidden layers skipped', async () => {
    const fromFigma = mapping(contract, {
      promo: frame('promo', { title: layer('heading') }),
      button: component('Action', { label: text('Text'), kind: variant('Kind', { Primary: 'primary', Secondary: 'secondary' }), block: boolean('Wide') }),
    })
    const result = await fromFigma.convert(file, '1:1')
    expect(result).toEqual({
      ok: true,
      errors: [],
      unmapped: [],
      warnings: [],
      sections: { promo: { component: 'promo', props: { title: 'Sale' }, children: [{ component: 'button', props: { label: 'Buy', kind: 'primary', block: true } }] } },
    })
  })

  it('a typo in a prop name fails when the mapping is created', () => {
    // @ts-expect-error — a compile error too
    expect(() => mapping(contract, { button: component('Action', { lable: text('Text') }) })).toThrow('"button" has no prop "lable"')
  })

  it('a plain frame maps only through frame() — a frame named like a contract component is layout', async () => {
    const result = await mapping(contract, { button: component('Action', { label: text('Text'), kind: variant('Kind', { Primary: 'primary' }) }) }).convert(file, '1:1')
    expect(result.sections).toEqual({ promo: { component: 'button', props: { label: 'Buy', kind: 'primary' } } })
    expect(result.unmapped).toEqual([{ path: 'promo/heading', reason: expect.stringContaining('text layer') }])
  })

  it('ignored layers are skipped whole and reported once', async () => {
    const fromFigma = mapping(contract, { promo: frame('promo', { title: layer('heading') }), button: component('Action', { label: text('Text'), kind: variant('Kind', { Primary: 'primary' }) }) }, { ignore: [/^but/i] })
    const result = await fromFigma.convert(file, '1:1')
    expect(result.sections).toEqual({ promo: { component: 'promo', props: { title: 'Sale' } } })
    expect(result.unmapped).toEqual([{ path: 'promo/Button[0]', reason: expect.stringContaining('ignored') }]) // the hidden one isn't reported
    const section = await mapping(contract, {}, { ignore: ['promo'] }).convert(file, '1:1')
    expect(section.unmapped).toEqual([{ path: 'promo', reason: expect.stringContaining('ignored') }])
  })

  it('a mapped frame that ends up empty is kept, with a warning', async () => {
    const empty = defineContract({ ...contract, grid: {} })
    const file2: FigmaNodesResponse = JSON.parse(JSON.stringify(file))
    file2.nodes['1:1']!.document.children![0].children!.push({ id: '1:7', name: 'cards', type: 'FRAME', children: [] })
    const fromFigma = mapping(empty, { promo: frame('promo', { title: layer('heading') }), grid: frame('cards'), button: component('Action', { label: text('Text'), kind: variant('Kind', { Primary: 'primary' }) }) })
    const result = await fromFigma.convert(file2, '1:1')
    expect(result.ok).toBe(true)
    expect(result.warnings).toEqual([{ path: 'promo/cards', message: expect.stringContaining('an empty "grid"') }])
  })

  it('a section with several blocks needs a container', async () => {
    const twoBlocks = mapping(contract, { button: component('Action', { label: text('Text'), kind: variant('Kind', { Primary: 'primary' }) }) })
    const file2: FigmaNodesResponse = JSON.parse(JSON.stringify(file))
    const section = file2.nodes['1:1']!.document.children![0]
    section.name = 'banner' // not a contract component: a plain layout frame
    section.children!.push({ ...section.children![1], id: '1:6' })
    const result = await twoBlocks.convert(file2, '1:1')
    expect(result.errors).toEqual([{ path: 'banner', figma: 'banner', message: expect.stringContaining('holds 2 blocks') }])
  })

  it('a node missing from the response says which nodes are there', async () => {
    await expect(mapping(contract, {}).convert(file, '9:9')).rejects.toThrow('nodes: 1:1')
  })
})

describe('dedal/figma — edge cases (from the code review)', () => {
  type Node = FigmaNodesResponse['nodes'][string] extends infer E ? (E extends { document: infer N } ? N : never) : never
  let id = 0
  const node = (name: string, type: string, rest: Partial<Node> = {}): Node => ({ id: `n${id++}`, name, type, ...rest })
  const textNode = (name: string, characters = name, rest: Partial<Node> = {}) => node(name, 'TEXT', { characters, ...rest })
  const instance = (componentId: string, componentProperties: Node['componentProperties'] = {}, children?: Node[]) =>
    node(componentId, 'INSTANCE', { componentId, componentProperties, ...(children && { children }) })
  const fileOf = (sections: Node[], extra: Partial<NonNullable<FigmaNodesResponse['nodes'][string]>> = {}): FigmaNodesResponse => ({
    nodes: {
      '1:1': {
        document: node('page', 'FRAME', { children: sections }),
        components: { card: { name: 'Card' }, button: { name: 'Button' }, braces: { name: 'name=braces', componentSetId: 'icons' }, check: { name: 'name=check', componentSetId: 'icons' } },
        componentSets: { icons: { name: 'Icon' } },
        ...extra,
      },
    },
  })
  const contract = defineContract({
    card: { props: z.object({ title: z.string().optional(), url: z.string().optional(), icon: z.string().optional() }) },
    button: { props: z.object({ label: z.string().optional() }) },
    list: {},
    text: { props: z.object({ text: z.string(), style: z.string().optional() }) },
  })

  it('a pattern with the g flag matches every frame, not every other one', async () => {
    const page = fileOf([node('cards', 'FRAME', { children: ['A', 'B', 'C'].map(title => node('card', 'FRAME', { children: [textNode('title', title)] })) })])
    const result = await mapping(contract, { card: frame(/^card$/g), list: frame(/^cards$/y) }, { ignore: [/^nothing$/g] }).convert(page, '1:1')
    expect(result.sections).toEqual({ cards: { component: 'list', children: ['A', 'B', 'C'].map(title => ({ component: 'card', props: { title } })) } })
  })

  it('two entries for one Figma component, or two contract names alike, fail when the mapping is created', () => {
    expect(() => mapping(contract, { button: component('Card'), card: component('card') })).toThrow('both map the Figma component')
    const alike = defineContract({ section_heading: {}, sectionHeading: {} })
    expect(() => mapping(alike, {})).toThrow('have the same name for Figma')
    expect(() => mapping(alike, { sectionHeading: component('Heading') })).not.toThrow()
  })

  it('the componentName rule applies to the names in component() too', async () => {
    const page = fileOf([instance('button')], { components: { button: { name: 'Action (Radix)' } } })
    const result = await mapping(contract, { button: component('Action (Radix)') }, { componentName: name => name.replace(/ \(Radix\)$/, '') }).convert(page, '1:1')
    expect(result.sections).toEqual({ button: { component: 'button' } })
  })

  it('explicit sources take only what they read: the first of two layers, a property but not a layer of the same name', async () => {
    const page = fileOf([node('promo', 'FRAME', { children: [textNode('title', 'First'), textNode('title', 'Second')] })])
    const result = await mapping(contract, { card: frame('promo', { title: layer('title') }) }).convert(page, '1:1')
    expect(result.sections).toEqual({ promo: { component: 'card', props: { title: 'First' } } })
    expect(result.unmapped).toEqual([{ path: 'promo/title[1]', reason: expect.stringContaining('text layer') }])

    const withProperty = fileOf([node('promo', 'FRAME', { children: [instance('button', { 'Caption#1:0': { type: 'TEXT', value: 'Buy' } }, [textNode('Caption', 'Buy')]), textNode('Caption', 'Loose')] })])
    const second = await mapping(contract, { button: component('Button', { label: text('Caption') }) }).convert(withProperty, '1:1')
    expect(second.unmapped).toEqual([{ path: 'promo/Caption', reason: expect.stringContaining('text layer') }])
  })

  it('a prop mapped explicitly isn\'t filled by the convention when its source finds nothing', async () => {
    const page = fileOf([instance('card', { 'Title#1:0': { type: 'TEXT', value: 'By convention' } })])
    const result = await mapping(contract, { card: component('Card', { title: text('Heading') }) }).convert(page, '1:1')
    expect(result.sections).toEqual({ card: { component: 'card' } })
  })

  it('an instance inside an instance is reported, not dropped', async () => {
    const page = fileOf([instance('card', {}, [instance('button')])])
    const result = await mapping(contract, {}).convert(page, '1:1')
    expect(result.sections).toEqual({ card: { component: 'card' } })
    expect(result.unmapped).toEqual([{ path: 'card/button', reason: expect.stringContaining('inside an instance of "Card"') }])
  })

  it('any container is layout — a component set too', async () => {
    const page = fileOf([node('set', 'COMPONENT_SET', { children: [instance('button')] })])
    const result = await mapping(contract, {}).convert(page, '1:1')
    expect(result.sections).toEqual({ set: { component: 'button' } })
  })

  it('a swap to a variant of a component set tells the variants apart', async () => {
    const page = fileOf(['braces', 'check'].map(icon => instance('card', { 'Icon#1:0': { type: 'INSTANCE_SWAP', value: icon } })))
    const result = await mapping(contract, { card: component('Card', { icon: swap('Icon', (set, { name }) => name.replace('name=', '')) }) }, { section: 'list' }).convert(page, '1:1')
    expect(result.sections).toEqual({ card: { component: 'card', props: { icon: 'braces' } }, 'card-2': { component: 'card', props: { icon: 'check' } } })
  })

  it('props with a schema that can\'t be read: explicit sources only, no convention', async () => {
    const union = defineContract({ card: { props: z.union([z.object({ title: z.string() }), z.object({ label: z.string() })]) } })
    const page = fileOf([node('promo', 'FRAME', { children: [textNode('title', 'T')] }), instance('card', { 'Anything#1:0': { type: 'TEXT', value: 'x' } })])
    const result = await mapping(union, { card: frame('promo', { title: layer('title') }) }).convert(page, '1:1')
    expect(result.sections).toEqual({ promo: { component: 'card', props: { title: 'T' } } })
    expect(result.unmapped).toEqual([{ path: 'card', reason: expect.stringContaining('no contract component maps') }])
  })

  it('the convention compares names loosely: a layer "URL" fills the prop "url"', async () => {
    const page = fileOf([node('promo', 'FRAME', { children: [textNode('URL', '/a')] })])
    const result = await mapping(contract, { card: frame('promo') }).convert(page, '1:1')
    expect(result.sections).toEqual({ promo: { component: 'card', props: { url: '/a' } } })
  })

  it('sections: duplicate names keep their own paths, a loose text is reported once, "__proto__" is a section like any other', async () => {
    const page = fileOf([
      node('s', 'FRAME', { children: [instance('button')] }),
      node('s', 'FRAME', { children: [textNode('x')] }),
      textNode('loose'),
      node('__proto__', 'FRAME', { children: [instance('button')] }),
    ])
    const result = await mapping(contract, {}).convert(page, '1:1')
    expect(Object.keys(result.sections)).toEqual(['s', '__proto__'])
    expect(result.sections.__proto__).toEqual({ component: 'button' })
    expect(result.unmapped).toEqual([
      { path: 's-2/x', reason: expect.stringContaining('text layer') },
      { path: 'loose', reason: expect.stringContaining('text layer') },
    ])
  })

  it('a node id from a URL, with every dash turned into a colon', async () => {
    const page: FigmaNodesResponse = { nodes: { 'I1:2;3:4': fileOf([instance('button')]).nodes['1:1'] } }
    expect((await mapping(contract, {}).convert(page, 'I1-2;3-4')).ok).toBe(true)
  })

  it('native slots: a contract slot by name, other slots as children; explicitly mapped; merged slots warn', async () => {
    const slotted = defineContract({ panel: { slots: { media: 'one', badges: 'many' } }, button: { props: z.object({ label: z.string().optional() }) } })
    const slotNode = (name: string, children: Node[]) => node(name, 'SLOT', { componentPropertyReferences: { slotContentId: `${name}#9:9` }, children })
    const page = fileOf([instance('panel', {}, [slotNode('Media', [instance('button')]), slotNode('Body', [instance('button'), instance('button')]), slotNode('Footer', [instance('button')])])], { components: { panel: { name: 'Panel' }, button: { name: 'Button' } } })
    const byDefault = await mapping(slotted, {}).convert(page, '1:1')
    expect(byDefault.sections).toEqual({ panel: { component: 'panel', slots: { media: { component: 'button' } }, children: [{ component: 'button' }, { component: 'button' }, { component: 'button' }] } })
    expect(byDefault.warnings).toEqual([{ path: 'panel', message: expect.stringContaining('"Body", "Footer"') }])

    const explicit = await mapping(slotted, { panel: component('Panel', {}, { slots: { badges: 'Footer' }, children: 'Body' }) }).convert(page, '1:1')
    expect(explicit.sections).toEqual({ panel: { component: 'panel', slots: { media: { component: 'button' }, badges: [{ component: 'button' }] }, children: [{ component: 'button' }, { component: 'button' }] } })
    expect(explicit.warnings).toEqual([])

    const onlyBody = await mapping(slotted, { panel: component('Panel', {}, { children: 'Body' }) }).convert(fileOf([instance('panel', {}, [slotNode('Extra', [instance('button')])])], { components: { panel: { name: 'Panel' }, button: { name: 'Button' } } }), '1:1')
    expect(onlyBody.unmapped).toEqual([{ path: 'panel/Extra', reason: expect.stringContaining('the slot "Extra"') }])
    expect(() => mapping(slotted, { panel: component('Panel', {}, { slots: { icon: 'Icon' } }) })).toThrow('has no slot "icon"')
  })

  it('the text option: loose text layers become text blocks, with the name of their Figma text style', async () => {
    const page = fileOf(
      [node('about', 'FRAME', { children: [textNode('heading', 'About us', { styles: { text: 's1' } }), textNode('body', 'We build pages.')] })],
      { styles: { s1: { name: 'h2', styleType: 'TEXT' } } }
    )
    const result = await mapping(contract, {}, { section: 'list', text: 'text' }).convert(page, '1:1')
    expect(result.sections).toEqual({
      about: { component: 'list', children: [{ component: 'text', props: { text: 'About us', style: 'h2' } }, { component: 'text', props: { text: 'We build pages.' } }] },
    })
    expect(() => mapping(contract, {}, { text: 'button' })).toThrow('has no prop "text"')
  })
})
