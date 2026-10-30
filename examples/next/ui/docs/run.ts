import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedNode, ResolvedPage } from 'dedal'
import { inspect, reportText, type DevtoolsMessage, type DevtoolsPayload } from 'dedal/devtools'
import type { Registry } from 'dedal/react'
import type { Contract } from '../contract'
import type { CaseOutput, DocCase, DocGroup } from './types'

export type CaseRun =
  | { kind: 'page'; output: CaseOutput; resolved: ResolvedPage<Contract>; payload: DevtoolsPayload; report: string }
  | { kind: 'thrown'; message: string }

/** Components used by the resolved page but missing from the registry — as the panel reports them. */
function missingComponents(resolved: ResolvedPage<Contract>, registry: Partial<Registry<Contract>>): DevtoolsMessage[] {
  const byComponent = new Map<string, string[]>()
  const visit = (node: ResolvedNode<Contract>) => {
    if (!(node.component in registry)) byComponent.set(node.component, [...(byComponent.get(node.component) ?? []), node.key])
    for (const content of Object.values(node.slots ?? {})) for (const child of [content].flat()) visit(child as ResolvedNode<Contract>)
    node.children?.forEach(visit)
  }
  resolved.sections.forEach(({ tree }) => visit(tree))
  return [...byComponent].map(([component, ids]) => ({
    level: 'error',
    subject: component,
    text: `is not in the registry — ${ids.length} node${ids.length === 1 ? '' : 's'} rendered by the fallback (or nothing): ${ids.join(', ')}; add “${component}” to the registry`,
  }))
}

/** Runs a case: a debug build and `resolve`, the devtools payload and its text report — or the thrown error. */
export async function runCase(docCase: DocCase, registry: Partial<Registry<Contract>>): Promise<CaseRun> {
  try {
    const output = await docCase.run()
    const result = output.beforeResolve ? output.beforeResolve(output.result) : output.result
    const resolved = output.ui.resolve(result, { ctx: output.ctx, trace: true, ...output.resolveOptions })
    const payload = inspect(result, resolved)
    const report = reportText(payload, { title: docCase.title, extra: missingComponents(resolved, registry) })
    return { kind: 'page', output, resolved, payload, report }
  } catch (error) {
    return { kind: 'thrown', message: error instanceof Error ? error.message : String(error) }
  }
}

/** A `// #region <name>` … `// #endregion` part of a file (path from the example root), dedented; the whole file without `region`. */
export function codeOf(file: string, region?: string): string {
  const source = readFileSync(join(process.cwd(), file), 'utf8')
  if (!region) return source.trimEnd()
  const marker = `// #region ${region}\n`
  const start = source.indexOf(marker)
  if (start === -1) return ''
  const body = source.slice(start + marker.length, source.indexOf('// #endregion', start)).replace(/\n+\s*$/, '')
  const indent = Math.min(...body.split('\n').filter(line => line.trim()).map(line => line.match(/^ */)![0].length))
  return body
    .split('\n')
    .map(line => line.slice(indent))
    .join('\n')
}

/** The code of a case: the `// #region <slug>` part of its group file. */
export const caseCode = (group: DocGroup, slug: string): string => codeOf(join('ui/docs', group.file), slug)
