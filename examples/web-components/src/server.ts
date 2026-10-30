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

  // the page as JSON: any frontend with a registry for this contract can render it
  if (url.pathname === '/api/home') {
    const ctx: Ctx = { device: url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop' }
    const resolved = ui.resolve(await home.build(ctx), { ctx })
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(resolved))
    return
  }

  const file = files[url.pathname]
  if (!file) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, { 'content-type': file[1] }).end(await readFile(new URL(`../public/${file[0]}`, import.meta.url)))
}).listen(port, () => console.log(`http://localhost:${port}`))
