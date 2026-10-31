import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Ctx } from './contract'
import { home } from './home.page'
import { ui } from './ui'

const files: Record<string, [file: string, type: string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/main.js': ['main.js', 'text/javascript; charset=utf-8'],
}

const port = Number(process.env.PORT ?? 3000)

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')

  const ctx: Ctx = { device: url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop' }

  // the page as JSON: any frontend with a registry for this contract can render it; deferred sections as placeholders
  // a deferred section on its own: /api/section?key=forYou — the same ctx as the page
  if (url.pathname === '/api/home' || url.pathname === '/api/section') {
    try {
      const key = url.searchParams.get('key')
      const result = url.pathname === '/api/section' && key ? await home.section(key, ctx) : await home.build(ctx)
      const resolved = ui.resolve(result, { ctx })
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(resolved))
    } catch (error) {
      // e.g. an invalid template: the message says which node and why
      console.error(error)
      response.writeHead(500, { 'content-type': 'text/plain' }).end(String(error instanceof Error ? error.message : error))
    }
    return
  }

  const file = files[url.pathname]
  if (!file) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, { 'content-type': file[1] }).end(await readFile(new URL(`../public/${file[0]}`, import.meta.url)))
}).listen(port, () => console.log(`http://localhost:${port}`))
