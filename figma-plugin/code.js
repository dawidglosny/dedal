// The Dedal plugin: builds what the local Dedal bridge sends — a page frame from a Dedal template (the mapping in
// reverse: instances of the file's library components, their properties set, their slots filled). Plain JavaScript,
// no build step. The UI (ui.html) talks to the bridge; this file talks to the document.

figma.showUI(__html__, { width: 340, height: 230 })

const warnings = []

async function textNode(node) {
  const text = figma.createText()
  const styles = await figma.getLocalTextStylesAsync()
  const style = node.style ? styles.find(s => s.name === node.style) : undefined
  if (style) {
    await figma.loadFontAsync(style.fontName)
    await text.setTextStyleIdAsync(style.id)
  } else {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    if (node.style) warnings.push(node.path + ': no local text style "' + node.style + '" — Inter Regular used')
  }
  text.characters = node.characters
  return text
}

async function instanceNode(node, images) {
  const main = await figma.getNodeByIdAsync(node.component.id)
  if (!main || (main.type !== 'COMPONENT' && main.type !== 'COMPONENT_SET')) {
    throw new Error(node.path + ': component "' + node.component.name + '" (' + node.component.id + ') is not in this file — open the file the template was planned for')
  }
  const instance = (main.type === 'COMPONENT_SET' ? main.defaultVariant : main).createInstance()
  // properties one by one, so one bad value doesn't drop the rest
  for (const key of Object.keys(node.properties)) {
    try {
      instance.setProperties({ [key]: node.properties[key] })
    } catch (error) {
      warnings.push(node.path + ': ' + key + ' = ' + JSON.stringify(node.properties[key]) + ' — ' + error.message)
    }
  }
  if (node.image) {
    const bytes = images[node.image]
    if (bytes) instance.fills = [{ type: 'IMAGE', imageHash: figma.createImage(bytes).hash, scaleMode: 'FILL' }]
    else warnings.push(node.path + ': image ' + node.image + ' could not be loaded')
  }
  for (const slotKey of Object.keys(node.slots)) {
    // slots are the instance's own children: by the slot property's key first, by name second
    const slots = instance.children.filter(child => child.type === 'SLOT')
    const slot =
      slots.find(child => child.componentPropertyReferences && child.componentPropertyReferences.slotContentId === slotKey) ||
      slots.find(child => child.name === slotKey.replace(/#.*$/, ''))
    if (!slot) {
      warnings.push(node.path + ': no slot ' + slotKey + ' in "' + node.component.name + '"')
      continue
    }
    for (const child of node.slots[slotKey]) slot.appendChild(await build(child, images))
  }
  return instance
}

function build(node, images) {
  return node.kind === 'text' ? textNode(node) : instanceNode(node, images)
}

async function buildPage(spec, images) {
  warnings.length = 0
  await figma.loadAllPagesAsync()
  const page = figma.currentPage
  const frame = figma.createFrame()
  frame.name = spec.name
  frame.layoutMode = 'VERTICAL'
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'AUTO'
  frame.fills = []
  let right = 0
  for (const child of page.children) if (child !== frame) right = Math.max(right, child.x + child.width)
  frame.x = right + 200
  frame.y = 0
  let created = 0
  for (const section of spec.sections) {
    const node = await build(section.node, images)
    node.name = section.key
    frame.appendChild(node)
    created++
  }
  figma.viewport.scrollAndZoomIntoView([frame])
  return { frameId: frame.id, created }
}

figma.ui.onmessage = async message => {
  if (message.type !== 'build') return
  try {
    const { frameId, created } = await buildPage(message.spec, message.images || {})
    figma.ui.postMessage({ type: 'result', id: message.id, ok: true, frameId, created, warnings: warnings.slice(), errors: [] })
    figma.notify('Dedal: built "' + message.spec.name + '" — ' + created + ' section(s)')
  } catch (error) {
    figma.ui.postMessage({ type: 'result', id: message.id, ok: false, warnings: warnings.slice(), errors: [error.message] })
    figma.notify('Dedal: ' + error.message, { error: true })
  }
}
