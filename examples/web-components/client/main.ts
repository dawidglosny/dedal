import type { ResolvedPage } from 'dedal'
import type { Contract } from '../src/contract'
import { defineComponents } from './components'
import { registry } from './registry'
import { renderPage } from './render'

defineComponents()

const device = new URLSearchParams(location.search).get('device') === 'mobile' ? 'mobile' : 'desktop'
const page: ResolvedPage<Contract> = await (await fetch(`/api/home?device=${device}`)).json()
renderPage(page, registry, document.querySelector('#app')!)
