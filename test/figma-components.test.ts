/**
 * dedal/figma on the component version of the demo file: every section is an instance of a library component, and
 * its content sits in native Figma slots. The REST API response is trimmed by scripts/figma-fixture.mjs.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { FigmaNodesResponse } from '../src/figma'
import fromFigma from './fixtures/figma-components.mapping'

const response = JSON.parse(readFileSync(new URL('./fixtures/figma-landing-components.json', import.meta.url), 'utf8')) as FigmaNodesResponse

describe('dedal/figma — sections as components, content in native slots', () => {
  it('the whole page converts and matches the contract', async () => {
    const result = await fromFigma.convert(response, '31:398')
    expect(result.errors).toEqual([])
    expect(Object.keys(result.sections)).toEqual(['nav', 'hero', 'principle', 'showcase', 'features', 'devtools', 'contract', 'Frame 427', 'cta', 'footer'])
  })

  it('a section component: variant props, a slot filled with instances that have slots of their own', async () => {
    const { sections } = await fromFigma.convert(response, '31:398')
    const principle = sections.principle as { component: string; props: unknown; children: { component: string; slots?: unknown; children?: unknown[] }[] }
    expect(principle.component).toBe('section')
    expect(principle.props).toEqual({ tone: 'default' })
    expect(principle.children[0]).toEqual({
      component: 'sectionHeading',
      props: { title: expect.stringContaining('Three things'), subtitle: expect.any(String), align: 'center', tone: 'default' },
      slots: { badge: { component: 'badge', props: { label: 'THE IDEA', variant: 'brand' } } },
    })
    expect(principle.children[1]).toMatchObject({ component: 'grid', children: [{ component: 'feature', props: { icon: 'pen-tool' } }, {}, {}] })
  })

  it('only the deliberately messy frame is reported: its icon, and its texts become text blocks', async () => {
    const { sections, unmapped, warnings } = await fromFigma.convert(response, '31:398')
    expect(unmapped).toEqual([{ path: 'Frame 427/Group 12/icon/lock-open', reason: expect.stringContaining('"icon/lock-open"') }])
    expect(warnings).toEqual([])
    expect(sections['Frame 427']).toEqual({
      component: 'section',
      children: [
        { component: 'text', props: { text: 'Open source, MIT licensed', style: 'h3' } },
        { component: 'text', props: { text: 'Read the code, fork it, send a pull request.', style: 'body-sm' } },
      ],
    })
  })

  it('the whole output — any change shows up as a diff', async () => {
    const { sections } = await fromFigma.convert(response, '31:398')
    expect(sections).toMatchSnapshot()
  })
})
