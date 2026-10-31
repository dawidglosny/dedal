/**
 * The local bridge between Dedal and the Dedal Figma plugin: building in Figma needs the Plugin API (the REST API can't
 * create nodes), and a plugin running in Figma desktop has no call limits. The plugin polls the bridge for jobs (a
 * build spec), builds them in the open file, and posts the result back. It also fetches images through the bridge —
 * files of the project (`public/…`) or remote URLs.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { FigmaBuildSpec } from './build'

/** What the plugin reports back after a build. */
export type FigmaBuildResult = { ok: boolean; frameId?: string; created?: number; warnings: string[]; errors: string[] }

export type Bridge = {
  url: string
  /** Queues a build and waits for the plugin's result — `undefined` when no plugin picked it up in time. */
  submit: (spec: FigmaBuildSpec, timeoutMs: number) => Promise<FigmaBuildResult | undefined>
  /** When the plugin last asked for a job (ms since epoch), or 0. */
  lastSeen: () => number
  close: () => Promise<void>
}

export const DEFAULT_BRIDGE_PORT = 7377

const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

type Job = { id: string; spec: FigmaBuildSpec; done: (result: FigmaBuildResult) => void; taken: boolean }

/** Starts the bridge on 127.0.0.1. `assets` — the directory image paths are served from (default: `<cwd>/public`). */
export function startBridge(options: { port?: number; cwd?: string; assets?: string } = {}): Promise<Bridge> {
  const port = options.port ?? DEFAULT_BRIDGE_PORT
  const assets = resolve(options.cwd ?? process.cwd(), options.assets ?? 'public')
  const queue: Job[] = []
  const waiting: ServerResponse[] = []
  let seen = 0
  let counter = 0

  const send = (response: ServerResponse, status: number, body?: unknown, type = 'application/json') => {
    response.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' })
    response.end(body === undefined ? undefined : body instanceof Uint8Array || typeof body === 'string' ? body : JSON.stringify(body))
  }
  const give = (response: ServerResponse) => {
    const job = queue.find(item => !item.taken)
    if (!job) return false
    job.taken = true
    send(response, 200, { id: job.id, spec: job.spec })
    return true
  }
  const readBody = (request: IncomingMessage) =>
    new Promise<string>((done, fail) => {
      let body = ''
      request.on('data', chunk => (body += chunk))
      request.on('end', () => done(body))
      request.on('error', fail)
    })

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
    if (request.method === 'OPTIONS') return send(response, 204)
    try {
      if (url.pathname === '/next') {
        seen = Date.now()
        if (give(response)) return
        const wait = Math.min(Number(url.searchParams.get('wait') ?? 20), 30) * 1000
        waiting.push(response)
        const timer = setTimeout(() => {
          const index = waiting.indexOf(response)
          if (index !== -1) waiting.splice(index, 1)
          send(response, 204)
        }, wait)
        response.on('close', () => clearTimeout(timer))
        return
      }
      if (url.pathname === '/result' && request.method === 'POST') {
        const result = JSON.parse(await readBody(request)) as FigmaBuildResult & { id: string }
        const index = queue.findIndex(job => job.id === result.id)
        if (index !== -1) queue.splice(index, 1)[0]!.done({ ok: result.ok, frameId: result.frameId, created: result.created, warnings: result.warnings ?? [], errors: result.errors ?? [] })
        return send(response, 200, { ok: true })
      }
      if (url.pathname === '/asset') {
        const remote = url.searchParams.get('url')
        if (remote) {
          const fetched = await fetch(remote)
          return send(response, fetched.status, new Uint8Array(await fetched.arrayBuffer()), fetched.headers.get('content-type') ?? 'application/octet-stream')
        }
        const path = resolve(assets, `.${url.searchParams.get('path') ?? ''}`)
        if (path !== assets && !path.startsWith(assets + sep)) return send(response, 403, { error: 'outside the assets directory' })
        return send(response, 200, new Uint8Array(await readFile(path)), TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream')
      }
      if (url.pathname === '/status') return send(response, 200, { ok: true, lastSeen: seen, queued: queue.length })
      send(response, 404, { error: 'not found' })
    } catch (error) {
      send(response, 500, { error: (error as Error).message })
    }
  })

  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const actual = typeof address === 'object' && address ? address.port : port
      done({
        url: `http://localhost:${actual}`,
        lastSeen: () => seen,
        submit: (spec, timeoutMs) =>
          new Promise(finish => {
            const job: Job = { id: String(++counter), spec, taken: false, done: result => (clearTimeout(timer), finish(result)) }
            const timer = setTimeout(() => {
              const index = queue.indexOf(job)
              if (index !== -1) queue.splice(index, 1)
              finish(undefined)
            }, timeoutMs)
            queue.push(job)
            const response = waiting.shift()
            if (response) give(response)
          }),
        close: () =>
          new Promise(closed => {
            for (const response of waiting.splice(0)) send(response, 204)
            server.close(() => closed())
            server.closeAllConnections?.()
          }),
      })
    })
  })
}
