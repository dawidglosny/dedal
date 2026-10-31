// Trims a Figma REST API response (GET /v1/files/:key/nodes) to the fields `dedal/figma` reads:
// structure, names, component links and properties, texts, text styles, visibility. Geometry, fills and vector shapes go.
// Usage: node scripts/figma-fixture.mjs test/fixtures/raw/figma-landing.json test/fixtures/figma-landing.json
import { readFileSync, writeFileSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
const KEEP = new Set(['id', 'name', 'type', 'visible', 'componentId', 'componentProperties', 'componentPropertyDefinitions', 'componentPropertyReferences', 'characters', 'styles'])
const SHAPES = new Set(['VECTOR', 'ELLIPSE', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'REGULAR_POLYGON', 'RECTANGLE'])

const trim = node => {
  const out = Object.fromEntries(Object.entries(node).filter(([key]) => KEEP.has(key)))
  const children = (node.children ?? []).filter(child => !SHAPES.has(child.type)).map(trim)
  return children.length ? { ...out, children } : out
}

const response = JSON.parse(readFileSync(input, 'utf8'))
const trimmed = {
  name: response.name,
  nodes: Object.fromEntries(
    Object.entries(response.nodes).map(([id, { document, components, componentSets, styles = {} }]) => [
      id,
      {
        document: trim(document),
        components,
        componentSets,
        // text styles only, by name: `'2:36' → { name: 'h1', styleType: 'TEXT' }`
        styles: Object.fromEntries(Object.entries(styles).filter(([, style]) => style.styleType === 'TEXT').map(([key, { name, styleType }]) => [key, { name, styleType }])),
      },
    ])
  ),
}
writeFileSync(output, JSON.stringify(trimmed, null, 1) + '\n')
console.log(`${output}: ${(JSON.stringify(trimmed).length / 1024).toFixed(0)} KB, nodes ${Object.keys(trimmed.nodes).join(', ')}`)
