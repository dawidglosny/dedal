import { highlight } from 'fumadocs-core/highlight'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import type { langOf } from './code'

type Lang = ReturnType<typeof langOf>

/** A code block for the docs pages: highlighted at build time, in the same frame as the code blocks of MDX pages. */
export async function Code({ code, lang = 'ts', title, tone }: { code: string; lang?: Lang; title?: string; tone?: 'error' }) {
  const rendered = await highlight(code, {
    lang: tone === 'error' ? 'text' : lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    components: { pre: props => <Pre {...props} /> },
  })
  return (
    <CodeBlock title={title} className={tone === 'error' ? 'code-error' : undefined}>
      {rendered}
    </CodeBlock>
  )
}
