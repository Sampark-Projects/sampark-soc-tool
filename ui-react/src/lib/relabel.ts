import { COMPONENTS } from '../data/components'

// For technical names that are only displayed (index names, field names, filters): "arkime_sessions3-261116" -> "packetvault_sessions3-261116".
// The real name stays in the data and in every query; only the text on screen changes.
const NAMES = COMPONENTS.map((c) => c.name.replace(/ /g, '[ _]')).join('|')
const TOKEN = new RegExp(`(?<![A-Za-z0-9])(${NAMES})(?![A-Za-z0-9])`, 'gi')
const HAS = new RegExp(`(?<![A-Za-z0-9])(${NAMES})(?![A-Za-z0-9])`, 'i')
export function niceName(s: string): string {
  return s.replace(TOKEN, (m) => {
    const c = COMPONENTS.find((x) => x.name.toLowerCase() === m.replace(/_/g, ' ').toLowerCase())
    if (!c) return m
    return m === m.toLowerCase() ? c.label.toLowerCase().replace(/ /g, '_') : c.label
  })
}

// Shows the new name instead of a product name in any visible text (titles, descriptions, field names, live data).
// Typed text (inputs, code and raw JSON blocks) is left alone so what you type and copy is the real name.
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'PRE', 'CODE', 'SELECT', 'OPTION'])

function fix(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = w.nextNode())) {
    const v = n.nodeValue
    if (!v || !HAS.test(v)) continue
    const p = n.parentElement
    if (!p || SKIP.has(p.tagName) || p.closest('pre,code,textarea')) continue
    const o = niceName(v)
    if (o !== v) n.nodeValue = o
  }
  // tooltips and labels
  if (root instanceof Element || root === document.body) {
    ;(root as Element).querySelectorAll('[title],[aria-label],[placeholder]').forEach((e) => {
      for (const a of ['title', 'aria-label', 'placeholder']) {
        const v = e.getAttribute(a)
        if (v && HAS.test(v)) e.setAttribute(a, niceName(v))
      }
    })
  }
}

export function startRelabel(): () => void {
  fix(document.body)
  let queued = false
  const mo = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      fix(document.body)
    })
  })
  mo.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => mo.disconnect()
}


// Page addresses: "zeek-weird" -> "protocolinspector-weird" (the address bar shows the new name).
export function niceSlug(s: string): string {
  return s.replace(TOKEN, (m) => {
    const c = COMPONENTS.find((x) => x.name.toLowerCase() === m.replace(/_/g, ' ').toLowerCase())
    return c ? c.label.toLowerCase().replace(/[ _]+/g, '-') : m
  })
}

// Back from a shown address to the real name: "packetvault_sessions3-*" -> "arkime_sessions3-*".
const REAL: [RegExp, string][] = COMPONENTS.filter((c, i, a) => a.findIndex((x) => x.label === c.label) === i).map((c) => [
  new RegExp(`(?<![A-Za-z0-9])${c.label.toLowerCase().replace(/ /g, '[_-]')}(?![A-Za-z0-9])`, 'g'),
  c.name.toLowerCase().replace(/ /g, '_'),
])
export function realId(s: string): string {
  let o = s
  for (const [re, to] of REAL) o = o.replace(re, to)
  return o
}
