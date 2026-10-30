// A tiny design system as Web Components: shadow DOM, named <slot>s, props as properties.
// They know nothing about Dedal — any custom elements (a library, your own design system) would do.

const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)

abstract class DsElement extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }
  connectedCallback() {
    this.shadowRoot!.innerHTML = this.template()
  }
  abstract template(): string
}

class DsHero extends DsElement {
  heading = ''
  lead = ''
  template() {
    return `<style>
        header { padding: 48px 32px; border-radius: 16px; background: linear-gradient(135deg, #0b1220, #1f3a8a 55%, #2f6bff); color: #fff; }
        h1 { margin: 0 0 8px; font-size: 36px; }
        p { margin: 0 0 24px; opacity: .85; }
        .actions { display: flex; gap: 12px; flex-wrap: wrap; }
      </style>
      <header><h1>${escape(this.heading)}</h1><p>${escape(this.lead)}</p><div class="actions"><slot name="actions"></slot></div></header>`
  }
}

class DsButton extends DsElement {
  label = ''
  href = '#'
  variant: 'solid' | 'outline' = 'solid'
  template() {
    return `<style>
        a { display: inline-block; padding: 10px 18px; border-radius: 8px; font-weight: 600; text-decoration: none; border: 2px solid #fff; }
        .solid { background: #e28025; border-color: #e28025; color: #fff; }
        .outline { color: #fff; }
      </style>
      <a class="${escape(this.variant)}" href="${escape(this.href)}">${escape(this.label)}</a>`
  }
}

class DsSection extends DsElement {
  heading = ''
  template() {
    return `<style>section { margin: 40px 0; } h2 { font-size: 24px; margin: 0 0 16px; }</style>
      <section><h2>${escape(this.heading)}</h2><slot></slot></section>`
  }
}

class DsGrid extends DsElement {
  columns = 3
  template() {
    return `<style>div { display: grid; gap: 16px; grid-template-columns: repeat(${Number(this.columns)}, minmax(0, 1fr)); }</style>
      <div><slot></slot></div>`
  }
}

class DsCard extends DsElement {
  heading = ''
  href = '#'
  size: 'sm' | 'md' | 'lg' = 'md'
  template() {
    return `<style>
        article { padding: 20px; border: 1px solid #dfe7f5; border-radius: 12px; background: #fff; height: 100%; box-sizing: border-box; }
        a { display: block; margin-top: 10px; color: #0f1b33; font-weight: 600; text-decoration: none; }
        .sm a { font-size: 15px; } .md a { font-size: 18px; } .lg a { font-size: 22px; }
      </style>
      <article class="${escape(this.size)}"><slot name="badge"></slot><a href="${escape(this.href)}">${escape(this.heading)}</a></article>`
  }
}

class DsBadge extends DsElement {
  label = ''
  tone: 'neutral' | 'accent' = 'neutral'
  template() {
    return `<style>
        span { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .neutral { background: #f5f8fd; color: #4d5b78; } .accent { background: #e8efff; color: #1d4fd8; }
      </style>
      <span class="${escape(this.tone)}">${escape(this.label)}</span>`
  }
}

export function defineComponents() {
  customElements.define('ds-hero', DsHero)
  customElements.define('ds-button', DsButton)
  customElements.define('ds-section', DsSection)
  customElements.define('ds-grid', DsGrid)
  customElements.define('ds-card', DsCard)
  customElements.define('ds-badge', DsBadge)
}
