import { highlight } from 'fumadocs-core/highlight'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
const langs = ['ts', 'tsx', 'json', 'bash', 'text'] as const
type Lang = (typeof langs)[number]

/** Language from a fence (```ts) or a file name; diagrams and plain text stay `text`. */
export function langOf(hint: string | undefined): Lang {
  const ext = hint?.split('.').pop()?.trim()
  return langs.find(lang => lang === ext) ?? (ext === 'mjs' || ext === 'js' ? 'ts' : ext === 'sh' ? 'bash' : 'text')
}

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
