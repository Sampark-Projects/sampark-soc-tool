import { COMPONENTS } from '../data/components'

// Shows the short label instead of a product name in any visible text (dashboard titles, descriptions, live data).
// Only the capitalised product names are replaced, so field values and index names (lowercase) stay untouched.
const MAP: [RegExp, string][] = COMPONENTS.filter((c) => c.name !== 'Sampark SOC Tool' && c.name !== 'Hedgehog Linux').map((c) => [
  new RegExp(`\\b${c.name === 'YARA' ? 'YARA' : c.name}\\b`, 'g'),
  c.label.replace(/,$/, ''),
])
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'PRE', 'CODE', 'SELECT', 'OPTION'])
const TEST = new RegExp(`\\b(${COMPONENTS.map((c) => c.name).join('|')})\\b`)

function fix(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = w.nextNode())) {
    const v = n.nodeValue
    if (!v || !TEST.test(v)) continue
    const p = n.parentElement
    if (!p || SKIP.has(p.tagName) || p.closest('pre,code,textarea')) continue
    let o = v
    for (const [re, to] of MAP) o = o.replace(re, to)
    if (o !== v) n.nodeValue = o
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
