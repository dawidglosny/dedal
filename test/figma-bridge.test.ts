/** The local bridge, over real HTTP on a free port: a plugin's side played by fetch. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { startBridge } from '../src/figma'

const spec = { version: 1 as const, name: 'Home', sections: [] }

describe('the bridge', () => {
  it('a job goes to the plugin, its result comes back to submit', async () => {
    const bridge = await startBridge({ port: 0 })
    try {
      const result = bridge.submit(spec, 5000)
      const job = await (await fetch(`${bridge.url}/next?wait=1`)).json()
      expect(job).toEqual({ id: '1', spec })
      expect(bridge.lastSeen()).toBeGreaterThan(0)
      await fetch(`${bridge.url}/result`, { method: 'POST', body: JSON.stringify({ id: job.id, ok: true, frameId: '9:9', created: 3, warnings: [] }) })
      expect(await result).toEqual({ ok: true, frameId: '9:9', created: 3, warnings: [], errors: [] })
    } finally {
      await bridge.close()
    }
  })

  it('a plugin already waiting gets the job at once; no plugin in time → undefined', async () => {
    const bridge = await startBridge({ port: 0 })
    try {
      const waiting = fetch(`${bridge.url}/next?wait=5`).then(response => response.json())
      await new Promise(resolve => setTimeout(resolve, 50))
      const result = bridge.submit(spec, 5000)
      const job = await waiting
      await fetch(`${bridge.url}/result`, { method: 'POST', body: JSON.stringify({ id: job.id, ok: false, errors: ['no component'] }) })
      expect(await result).toMatchObject({ ok: false, errors: ['no component'] })
      expect(await bridge.submit(spec, 50)).toBeUndefined()
      expect((await fetch(`${bridge.url}/next?wait=0`)).status).toBe(204) // the timed-out job is gone
    } finally {
      await bridge.close()
    }
  })

  it('serves images from the assets directory only', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dedal-bridge-'))
    mkdirSync(join(dir, 'public', 'figma'), { recursive: true })
    writeFileSync(join(dir, 'public', 'figma', 'a.png'), new Uint8Array([137, 80, 78, 71]))
    writeFileSync(join(dir, 'secret.txt'), 'no')
    const bridge = await startBridge({ port: 0, cwd: dir })
    try {
      const image = await fetch(`${bridge.url}/asset?path=/figma/a.png`)
      expect(image.headers.get('content-type')).toBe('image/png')
      expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([137, 80, 78, 71])
      expect((await fetch(`${bridge.url}/asset?path=/../secret.txt`)).status).toBe(403)
    } finally {
      await bridge.close()
    }
  })
})
