/**
 * templateToFigma: the mapping in reverse. A round trip on the demo file — Figma frame → template → build spec →
 * (a simulated plugin builds REST-shaped nodes) → template — must give the same template back.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineContract } from '../src'
import { component, layer, mapping, templateToFigma, variant, type FigmaBuildNode, type FigmaBuildSpec, type FigmaLibraryComponent, type FigmaNode, type FigmaNodesResponse } from '../src/figma'
import fromFigma from './fixtures/figma-components.mapping'

const response = JSON.parse(readFileSync(new URL('./fixtures/figma-landing-components.json', import.meta.url), 'utf8')) as FigmaNodesResponse
const entry = response.nodes['31:398']!

/** The library, as libraryFromFile would read it — here assembled from the instances in the fixture. */
function libraryOf(): FigmaLibraryComponent[] {
  const library = new Map<string, FigmaLibraryComponent>()
  const walk = (node: FigmaNode) => {
    if (node.type === 'INSTANCE' && node.componentId) {
      const meta = entry.components[node.componentId]!
      const id = meta.componentSetId ?? node.componentId
      const name = meta.componentSetId ? entry.componentSets[meta.componentSetId]!.name : meta.name
      const item = library.get(id) ?? { id, name, type: meta.componentSetId ? ('COMPONENT_SET' as const) : ('COMPONENT' as const), definitions: {} }
      for (const [key, { type, value }] of Object.entries(node.componentProperties ?? {})) {
        const def = (item.definitions[key] ??= { type, ...(type === 'VARIANT' && { variantOptions: [] as string[] }) })
        if (type === 'VARIANT' && !def.variantOptions!.includes(String(value))) def.variantOptions!.push(String(value))
      }
      library.set(id, item)
    }
    node.children?.forEach(walk)
  }
  walk(entry.document)
  // components used only as swap targets (icons)
  for (const [id, meta] of Object.entries(entry.components)) if (!meta.componentSetId && !library.has(id)) library.set(id, { id, name: meta.name, type: 'COMPONENT', definitions: {} })
  return [...library.values()]
}

/** What the plugin does, in REST shape: instances with their properties, slots with their content, text layers. */
function simulate(spec: FigmaBuildSpec, library: FigmaLibraryComponent[]): FigmaNodesResponse {
  let id = 0
  const components: Record<string, { name: string; componentSetId?: string }> = {}
  const componentSets: Record<string, { name: string }> = {}
  for (const item of library) {
    if (item.type === 'COMPONENT_SET') {
      componentSets[item.id] = { name: item.name }
      components[`${item.id}/v`] = { name: 'variant', componentSetId: item.id }
    } else components[item.id] = { name: item.name }
  }
  const build = (node: FigmaBuildNode, name?: string): FigmaNode => {
    if (node.kind === 'text') return { id: `t${id++}`, name: 'text', type: 'TEXT', characters: node.characters, ...(node.style && { styles: { text: node.style } }) }
    const item = library.find(candidate => candidate.id === node.component.id)!
    const componentProperties = Object.fromEntries(
      Object.entries(item.definitions).filter(([key, def]) => def.type !== 'SLOT' && key in node.properties).map(([key, def]) => [key, { type: def.type, value: node.properties[key] }])
    )
    const slots = Object.entries(node.slots).map(([key, children]) => ({
      id: `s${id++}`, name: key.replace(/#.*$/, ''), type: 'SLOT', componentPropertyReferences: { slotContentId: key }, children: children.map(child => build(child)),
    }))
    return {
      id: `n${id++}`, name: name ?? item.name, type: 'INSTANCE', componentId: item.type === 'COMPONENT_SET' ? `${item.id}/v` : item.id, componentProperties,
      ...(node.image && { fills: [{ type: 'IMAGE', imageRef: node.image.replace('figma-image:', '') }] }), ...(slots.length && { children: slots }),
    }
  }
  const styles = Object.fromEntries(Object.entries(entry.styles ?? {}).map(([styleId, style]) => [style.name, styleId]))
  const withStyles = (node: FigmaNode): FigmaNode => ({ ...node, ...(node.styles?.text && { styles: { text: styles[node.styles.text] ?? node.styles.text } }), ...(node.children && { children: node.children.map(withStyles) }) })
  return {
    nodes: {
      '1:1': {
        document: { id: '1:1', name: spec.name, type: 'FRAME', children: spec.sections.map(({ key, node }) => withStyles(build(node, key))) },
        components, componentSets, styles: entry.styles ?? {},
      },
    },
  }
}

describe('templateToFigma', () => {
  it('a round trip on the demo file: the same template back', async () => {
    const library = libraryOf()
    const original = await fromFigma.convert(response, '31:398')
    expect(original.ok).toBe(true)
    const plan = templateToFigma(original.sections, { mapping: fromFigma, library, name: 'Home' })
    expect(plan.unmapped).toEqual([])
    const again = await fromFigma.convert(simulate(plan.spec, library), '1:1')
    expect(again.errors).toEqual([])
    // Frame 427 was a plain frame (the section option wrapped it); rebuilt, it's a Section instance with its default tone
    const { 'Frame 427': rebuilt, ...rest } = again.sections as Record<string, { props?: unknown }>
    const { 'Frame 427': wrapped, ...originalRest } = original.sections as Record<string, { props?: unknown }>
    expect(rest).toEqual(originalRest)
    expect({ ...rebuilt, props: undefined }).toEqual({ ...wrapped, props: undefined })
  })

  it('the spec: library components by id, properties by their exact keys, slots by their keys, swaps as component ids', () => {
    const library = libraryOf()
    const plan = templateToFigma(
      { features: { component: 'grid', children: [{ component: 'feature', props: { title: 'Fast', description: 'Very', icon: 'zap' } }] } },
      { mapping: fromFigma, library }
    )
    const grid = plan.spec.sections[0]!.node as Extract<FigmaBuildNode, { kind: 'instance' }>
    expect(grid.component.name).toBe('Grid')
    const [slotKey, [card]] = Object.entries(grid.slots)[0]! as [string, Extract<FigmaBuildNode, { kind: 'instance' }>[]]
    expect(slotKey).toMatch(/^Items#/)
    expect(card).toMatchObject({ component: { name: 'FeatureCard' }, path: 'features.children[0]' })
    expect(Object.keys(card.properties).sort()).toEqual([expect.stringMatching(/^Description#/), expect.stringMatching(/^Icon#/), expect.stringMatching(/^Title#/)])
    const zap = library.find(item => item.name === 'icon/zap')!
    expect(Object.entries(card.properties).find(([key]) => key.startsWith('Icon#'))![1]).toBe(zap.id)
  })

  it('what has no counterpart in Figma is reported by template path, not invented', () => {
    const contract = defineContract({
      card: { props: z.object({ title: z.string(), kind: z.string().optional(), subtitle: z.string().optional() }) },
      ghost: {},
    })
    const library: FigmaLibraryComponent[] = [{ id: '1:1', name: 'Card', type: 'COMPONENT_SET', definitions: { 'Title#1:0': { type: 'TEXT' }, Kind: { type: 'VARIANT', variantOptions: ['Primary', 'Secondary'] } } }]
    const reversible = mapping(contract, { card: component('Card', { kind: variant('Kind', { Primary: 'primary' }), subtitle: layer('subtitle') }) })
    const plan = templateToFigma(
      {
        a: { component: 'card', props: { title: 'T', kind: 'primary', subtitle: 'S' } },
        b: { component: 'card', props: { title: 'T', kind: 'tertiary' } },
        c: { component: 'ghost' },
      },
      { mapping: reversible, library }
    )
    expect((plan.spec.sections[0]!.node as Extract<FigmaBuildNode, { kind: 'instance' }>).properties).toEqual({ 'Title#1:0': 'T', Kind: 'Primary' }) // the value map in reverse
    expect(plan.ok).toBe(false)
    expect(plan.unmapped).toEqual([
      { path: 'a.props.subtitle', reason: expect.stringContaining('read from the text layer "subtitle"') },
      { path: 'b.props.kind', reason: '"tertiary" is not an option of "Kind" (Primary, Secondary)' },
      { path: 'c', reason: 'no component of the Figma library maps to "ghost"' },
    ])
  })
})
