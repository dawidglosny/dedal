// Demo: builds the page on mocks and prints sections, node count and the report. Run: npm run demo
import type { Device } from './contract'
import { createHomePage } from './home.page'
import { createMockApi } from './mocks'

const count = (node: { slots?: Record<string, unknown>; children?: unknown[] }): number =>
  1 +
  Object.values(node.slots ?? {})
    .flat()
    .reduce<number>((sum, child) => sum + count(child as never), 0) +
  (node.children ?? []).reduce<number>((sum, child) => sum + count(child as never), 0)

for (const device of ['desktop', 'mobile'] as Device[]) {
  const { ui, home } = createHomePage(createMockApi())
  const result = await home.build({ device, url: 'https://example.com' })
  const resolved = ui.resolve(result)

  console.log(`\n=== ${device} ===`)
  for (const { key, tree } of resolved.sections) console.log(`  ${key.padEnd(16)} ${count(tree)} nodes`)
  console.log(`  issues: ${resolved.issues.length} · removed sections: ${result.report.removedSections.join(', ') || '—'}`)
  console.log(`  JSON: ${(JSON.stringify(result).length / 1024).toFixed(1)} KB (PageResult)`)
}
