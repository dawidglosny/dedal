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
  grid: frame(/-(grid|row)$/),
  group: frame(/-(actions|links)$/),
}

describe('dedal/figma — the shadcn/ui version', () => {
  const fromFigma = mapping(shadcn, frames, { section: 'section' })

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
    expect(unmapped).toContainEqual({ path: 'hero/pipeline/pipeline-step[0]/01 · STRUCTURE', reason: expect.stringContaining('text layer') })
    expect(unmapped).toContainEqual({ path: 'hero/pipeline/arrow[1]', reason: expect.stringContaining('"icon/arrow-right"') })
  })

  it('a contract that doesn\'t match the design fails with the template path', async () => {
    const strict = defineContract({ ...shadcn, badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary', 'outline']).optional() }) } })
    const result = await mapping(strict, frames, { section: 'section' }).convert(response, '5:2')
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual({ path: 'hero.children[0].props.variant', message: expect.any(String) })
  })
})

describe('dedal/figma — the Radix version, with its own contract', () => {
  const fromFigma = mapping(radix, frames, { section: 'section', componentName: name => name.replace(/ \(Radix\)$/, '') })

  it('converts with Radix\'s own values — not translated to another library\'s', async () => {
    const result = await fromFigma.convert(response, '14:198')
    expect(result.errors).toEqual([])
    const nav = result.sections.nav as { children: { component: string; children?: { props?: unknown }[] }[] }
    expect(nav.children[0]).toEqual({ component: 'logo' }) // "Logo (Radix)" through the name rule
    expect(nav.children[1].children?.[0]).toEqual({ component: 'button', props: { label: 'Docs', variant: 'ghost', color: 'gray', size: '2', iconRight: false } })
    expect(JSON.stringify(result.sections.devtools)).toContain('"component":"callout"')
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
      sections: { promo: { component: 'promo', props: { title: 'Sale' }, children: [{ component: 'button', props: { label: 'Buy', kind: 'primary', block: true } }] } },
    })
  })

  it('a typo in a prop name fails when the mapping is created', () => {
    expect(() => mapping(contract, { button: component('Action', { lable: text('Text') } as never) })).toThrow('"button" has no prop "lable"')
  })

  it('a section with several blocks needs a container', async () => {
    const twoBlocks = mapping(contract, { button: component('Action', { label: text('Text'), kind: variant('Kind', { Primary: 'primary' }) }) })
    const file2: FigmaNodesResponse = JSON.parse(JSON.stringify(file))
    const section = file2.nodes['1:1']!.document.children![0]
    section.name = 'banner' // not a contract component: a plain layout frame
    section.children!.push({ ...section.children![1], id: '1:6' })
    const result = await twoBlocks.convert(file2, '1:1')
    expect(result.errors).toEqual([{ path: 'banner', message: expect.stringContaining('holds 2 blocks') }])
  })

  it('a node missing from the response says which nodes are there', async () => {
    await expect(mapping(contract, {}).convert(file, '9:9')).rejects.toThrow('nodes: 1:1')
  })
})
