import { savedObject } from '../api'
import type { DashboardDef, LogsDef, PanelDef } from '../data/catalog'

// Builds a dashboard definition at run time from the saved objects stored on the server, for dashboards that are
// not in the pre-built catalog. Same rules as the catalog: terms / time / metric / controls panels are drawn from
// the aggregation API; everything else is listed as not shown.
const parse = (s: unknown): any => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s
  } catch {
    return null
  }
}

type Filter = Record<string, string | string[]>

// Understands the simple Lucene the dashboards use: field:value, field:"a b", field:(a OR b), NOT field:value, joined by AND.
export function parseSimpleQuery(q: string | null | undefined): { filter: Filter; ok: boolean } {
  const text = (q ?? '').trim()
  if (!text || text === '*') return { filter: {}, ok: true }
  const filter: Filter = {}
  const parts = text.split(/\s+AND\s+/)
  for (const raw of parts) {
    let t = raw.trim()
    let neg = false
    const n = /^(NOT\s+|!)(.*)$/.exec(t)
    if (n) {
      neg = true
      t = n[2].trim()
    }
    const m = /^([\w.@-]+):(?:"([^"]*)"|\(([^()]*)\)|([^\s()"]+))$/.exec(t)
    if (!m) return { filter: {}, ok: false }
    const key = neg ? `!${m[1]}` : m[1]
    if (m[3] !== undefined) {
      const vals = m[3].split(/\s+OR\s+/).map((v) => v.trim().replace(/^"|"$/g, ''))
      if (vals.some((v) => !v || /[\s*?]/.test(v))) return { filter: {}, ok: false }
      filter[key] = vals
    } else {
      const v = m[2] ?? m[4]
      if (v === undefined || /[*?]/.test(v)) return { filter: {}, ok: false }
      filter[key] = v
    }
  }
  return { filter, ok: true }
}

const queryOf = (attrs: any): string => {
  const src = parse(attrs?.kibanaSavedObjectMeta?.searchSourceJSON)
  const q = src?.query?.query
  return typeof q === 'string' ? q : q?.query_string?.query ?? ''
}

function toPanel(title: string, attrs: any): PanelDef | null {
  const vs = parse(attrs?.visState) ?? {}
  const type: string = vs.type ?? ''
  if (type === 'markdown') return null
  const aggs: any[] = vs.aggs ?? []
  const fields = Array.from(new Set(aggs.filter((a) => a.type === 'terms' && a.params?.field).map((a) => String(a.params.field))))
  const hasDate = aggs.some((a) => a.type === 'date_histogram')
  const { filter, ok } = parseSimpleQuery(queryOf(attrs))
  const base = { title, vis: type, metric: 'count', metricField: null, filter, filterOk: ok }
  if (type === 'input_control_vis') {
    const cf: string[] = (vs.params?.controls ?? []).map((c: any) => c.fieldName).filter(Boolean)
    return { ...base, kind: 'controls', fields: cf }
  }
  if (type === 'region_map') return { ...base, kind: 'unsupported', fields }
  if (['vega', 'metrics', 'timelion', 'tile_map', 'maps', 'graph'].includes(type)) return { ...base, kind: 'unsupported', fields }
  if (hasDate && ['line', 'histogram', 'area', 'horizontal_bar'].includes(type)) return { ...base, kind: 'time', fields: [] }
  if (fields.length) return { ...base, kind: 'terms', fields }
  if (type === 'metric' || type === 'gauge' || type === 'goal') return { ...base, kind: 'metric', fields: [] }
  return { ...base, kind: 'unsupported', fields }
}

export async function loadSavedDashboard(id: string): Promise<DashboardDef> {
  const dash = await savedObject('dashboard', id)
  const attrs = dash.attributes ?? {}
  const refs: { name: string; type: string; id: string }[] = dash.references ?? []
  const res = await fetch('/dashboards/api/saved_objects/_bulk_get', {
    method: 'POST',
    headers: { 'osd-xsrf': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify(refs.map((r) => ({ type: r.type, id: r.id }))),
  })
  const got: any[] = res.ok ? ((await res.json()).saved_objects ?? []) : []
  const byKey = new Map(got.map((o) => [`${o.type}:${o.id}`, o]))
  const panelsJSON: any[] = parse(attrs.panelsJSON) ?? []

  const panels: PanelDef[] = []
  let logs: LogsDef | null = null
  for (const p of panelsJSON) {
    const ref = refs.find((r) => r.name === p.panelRefName)
    const obj = ref ? byKey.get(`${ref.type}:${ref.id}`) : undefined
    if (!obj) continue
    const title = p.embeddableConfig?.title ?? obj.attributes?.title ?? ref!.id
    if (obj.type === 'search') {
      if (!logs) {
        const { filter, ok } = parseSimpleQuery(queryOf(obj.attributes))
        logs = { title, columns: obj.attributes?.columns ?? [], query: queryOf(obj.attributes) || null, filter, ok }
      }
    } else if (obj.type === 'visualization') {
      const panel = toPanel(title, obj.attributes)
      if (panel) panels.push(panel)
    }
  }
  return { id, title: attrs.title ?? id, slug: `saved/${id}`, group: 'Other', description: attrs.description ?? '', logs, panels }
}
