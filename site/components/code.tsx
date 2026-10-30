import { createHighlighter, type Highlighter } from 'shiki'
import { CopyButton } from './copy-button'

const langs = ['ts', 'tsx', 'json', 'bash', 'text'] as const
type Lang = (typeof langs)[number]

let highlighter: Promise<Highlighter> | undefined
const getHighlighter = () => (highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: [...langs] }))

/** Language from a fence (```ts) or a file name; diagrams and plain text stay `text`. */
export function langOf(hint: string | undefined): Lang {
  const ext = hint?.split('.').pop()?.trim()
  return langs.find(lang => lang === ext) ?? (ext === 'mjs' || ext === 'js' ? 'ts' : ext === 'sh' ? 'bash' : 'text')
}

/** A code block highlighted at build time (light and dark themes via CSS variables), with a copy button. */
export async function Code({ code, lang = 'ts', title, tone }: { code: string; lang?: Lang; title?: string; tone?: 'error' }) {
  const html = (await getHighlighter()).codeToHtml(code, {
    lang: tone === 'error' ? 'text' : lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })
  return (
    <figure className={`code${tone ? ` code-${tone}` : ''}`}>
      {title && <figcaption>{title}</figcaption>}
      <div className="code-body">
        <CopyButton text={code} />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </figure>
  )
}
