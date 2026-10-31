// Figma → templates for this design system. Almost everything follows the convention (component, property and
// slot names match the contract); only what doesn't is written here. Used by `npm run pull` (dedal-figma).
import { component, image, mapping, swap } from 'dedal/figma'
import { contract } from './ui/contract.mjs'

export default mapping(
  contract,
  {
    feature: component('FeatureCard', { icon: swap('Icon', name => name.replace('icon/', '')) }), // instance swap → 'braces'
    image: component('Image', { src: image() }), // the picture is the instance's image fill
  },
  { section: 'section', text: 'text' }
)
