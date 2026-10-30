import type { ResolvedPage } from 'dedal'
import type { Contract } from '../src/contract'
import { defineComponents } from './components'
import { registry } from './registry'
import { renderPage, replaceSection } from './render'

defineComponents()

const device = new URLSearchParams(location.search).get('device') === 'mobile' ? 'mobile' : 'desktop'
const root = document.querySelector('#app')!

const page: ResolvedPage<Contract> = await (await fetch(`/api/home?device=${device}`)).json()
renderPage(page, registry, root)

// deferred sections came as placeholders: fetch each one from its own endpoint and swap it in
for (const { key } of page.sections.filter(section => section.deferred)) {
  fetch(`/api/section?key=${encodeURIComponent(key)}&device=${device}`)
    .then(response => (response.ok ? response.json() : { sections: [] }))
    .then((result: ResolvedPage<Contract>) => replaceSection(root, key, result, registry))
}
