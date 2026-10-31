/** contractFromFigma on the real component definitions of the demo file (REST, trimmed). */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineContract } from '../src'
import { contractFromFigma, mapping, type FigmaNodesResponse } from '../src/figma'
import fromFigma from './fixtures/figma-components.mapping'

const response = JSON.parse(readFileSync(new URL('./fixtures/figma-landing.json', import.meta.url), 'utf8')) as FigmaNodesResponse
const entry = (id: string) => response.nodes[id]!

describe('contractFromFigma', () => {
  it('a component set: text → string, boolean, variants → enums of their options; the convention finds it, no mapping entry', () => {
    const proposal = contractFromFigma(entry('3:136'))
    expect(proposal.key).toBe('button')
    expect(proposal.code).toBe(
      [
        'button: {',
        '  props: z.object({',
        '    label: z.string(),',
        '    iconRight: z.boolean().optional(),',
        "    variant: z.enum(['default', 'secondary', 'outline', 'ghost', 'brand']).optional(),",
        "    size: z.enum(['default', 'lg']).optional(),",
        '  }),',
        '},',
      ].join('\n')
    )
    expect(proposal.registryStub).toContain('button: ({ label, iconRight, variant, size }) =>')
    expect(proposal.mappingEntry).toBeUndefined()
    expect(proposal.questions).toEqual([expect.stringContaining('Which texts are required? Proposed as required: label')])
  })

  it('an instance swap: the name of the swapped component, a question, a mapping entry for the transform', () => {
    const proposal = contractFromFigma(entry('3:148'))
    expect(proposal.key).toBe('featureCard')
    expect(proposal.props.find(prop => prop.prop === 'icon')).toMatchObject({ source: 'swap', type: 'string', default: 'icon/layers', optional: true })
    expect(proposal.questions[0]).toContain('"icon" is an instance swap')
    expect(proposal.mappingEntry).toBe("featureCard: component('FeatureCard', { icon: swap('Icon', name => name) }),")
  })

  it('with a mapping: the contract key it maps to, and how the design differs from the entry the contract has', () => {
    const feature = contractFromFigma(entry('3:148'), { mapping: fromFigma })
    expect(feature.key).toBe('feature') // mapped explicitly: feature ← FeatureCard
    expect(feature.mappingEntry).toBeUndefined()
    expect(feature.drift).toEqual({ key: 'feature', missingProps: [], missingValues: {}, missingSlots: [], extraProps: [] })

    const older = defineContract({
      badge: { props: z.object({ label: z.string(), variant: z.enum(['default', 'secondary']).optional(), tone: z.string().optional() }) },
    })
    const drift = contractFromFigma(entry('3:147'), { mapping: mapping(older, {}) }).drift
    expect(drift).toEqual({ key: 'badge', missingProps: [], missingValues: { variant: ['outline', 'brand', 'accent'] }, missingSlots: [], extraProps: ['tone'] })
  })

  it('a library suffix: a question without a rule, the key after the rule with one', () => {
    const plain = contractFromFigma(entry('13:318'))
    expect(plain.key).toBe('buttonRadix')
    expect(plain.questions).toContainEqual(expect.stringContaining('ends with "(Radix)" — a library suffix?'))
    const ruled = contractFromFigma(entry('13:318'), { componentName: name => name.replace(/ \(Radix\)$/, '') })
    expect(ruled.key).toBe('button')
    expect(ruled.props.find(prop => prop.prop === 'size')?.values).toEqual(['2', '3'])
    expect(ruled.questions.some(question => question.includes('library suffix'))).toBe(false)
  })

  it('native slots: a slot each, a list by default, and a question; no properties at all: a question', () => {
    const navbar = contractFromFigma({
      document: { id: '9:1', name: 'Navbar', type: 'COMPONENT', componentPropertyDefinitions: { 'Links#30:6': { type: 'SLOT', preferredValues: [] }, 'Actions#30:7': { type: 'SLOT' } } } as never,
      components: {},
      componentSets: {},
    })
    expect(navbar.slots).toEqual([{ slot: 'links', figma: 'Links#30:6', kind: 'many' }, { slot: 'actions', figma: 'Actions#30:7', kind: 'many' }])
    expect(navbar.code).toBe("navbar: {\n  slots: { links: 'many', actions: 'many' },\n},")
    expect(navbar.questions).toContainEqual('Slot "links": one block or a list? Proposed: a list (\'many\').')
    const logo = contractFromFigma({ document: { id: '9:2', name: 'Logo', type: 'COMPONENT' }, components: {}, componentSets: {} })
    expect(logo.code).toBe('logo: {},')
    expect(logo.questions[0]).toContain('has no component properties')
  })

  it('not a component: a clear error', () => {
    expect(() => contractFromFigma({ document: { id: '1:1', name: 'hero', type: 'FRAME' }, components: {}, componentSets: {} })).toThrow('is a FRAME, not a component')
    expect(() => contractFromFigma({ document: { id: '3:88', name: 'variant=outline', type: 'COMPONENT' }, components: { '3:88': { name: 'variant=outline', componentSetId: '3:136' } }, componentSets: {} })).toThrow('is a variant of a component set')
  })
})
