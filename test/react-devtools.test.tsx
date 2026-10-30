// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Devtools } from '../src/react/devtools'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const host = () => document.querySelector('#dedal-devtools')
const panel = () => host()?.shadowRoot?.querySelector('.panel') as HTMLElement | null | undefined

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
  sessionStorage.clear()
})

function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement('div')
  document.body.append(container)
  root ??= createRoot(container)
  act(() => root!.render(element))
}

describe('<Devtools>', () => {
  it('nic nie renderuje w drzewie React; panel montuje się po załadowaniu kodu panelu', async () => {
    render(createElement(Devtools))

    expect(document.body.querySelector('div')!.innerHTML).toBe('')
    await vi.waitFor(() => expect(host()).not.toBeNull())
    expect(panel()!.hidden).toBe(true)
  })

  it('open: panel otwarty od razu', async () => {
    render(createElement(Devtools, { open: true }))

    await vi.waitFor(() => expect(panel()?.hidden).toBe(false))
  })

  it('without open: the panel restores the state remembered in this browser tab', async () => {
    sessionStorage.setItem('dedal-devtools', JSON.stringify({ open: true, tab: 'tree', side: 'right' }))
    render(createElement(Devtools))

    await vi.waitFor(() => expect(panel()?.hidden).toBe(false))
  })

  it('open={false} closes the panel despite the remembered state', async () => {
    sessionStorage.setItem('dedal-devtools', JSON.stringify({ open: true, tab: 'tree', side: 'right' }))
    render(createElement(Devtools, { open: false }))

    await vi.waitFor(() => expect(host()).not.toBeNull())
    expect(panel()!.hidden).toBe(true)
  })

  it('odmontowanie komponentu usuwa panel', async () => {
    render(createElement(Devtools))
    await vi.waitFor(() => expect(host()).not.toBeNull())

    act(() => root!.unmount())
    root = undefined

    expect(host()).toBeNull()
  })

  it('zmiana open montuje panel ponownie z nową opcją', async () => {
    render(createElement(Devtools))
    await vi.waitFor(() => expect(panel()?.hidden).toBe(true))

    render(createElement(Devtools, { open: true }))
    await vi.waitFor(() => expect(panel()?.hidden).toBe(false))
    expect(document.querySelectorAll('#dedal-devtools')).toHaveLength(1)
  })

  it('odmontowanie przed załadowaniem kodu panelu — panel nie pojawia się później', async () => {
    render(createElement(Devtools))
    act(() => root!.unmount())
    root = undefined

    await import('../src/devtools/panel')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(host()).toBeNull()
  })
})
