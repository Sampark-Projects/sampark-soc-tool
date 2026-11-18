import raw from './dashboards.json'
import { niceSlug } from '../lib/relabel'

// Generated from the original OpenSearch Dashboards saved objects in dashboards/dashboards/*.json
// (titles, visualization types, aggregation fields, saved-search queries and columns).
export interface PanelDef {
  title: string
  vis: string
  kind: 'terms' | 'time' | 'metric' | 'sankey' | 'tree' | 'filetree' | 'controls' | 'unsupported' | 'other'
  fields: string[]
  metric: string | null
  metricField: string | null
  filter: Record<string, string | string[]>
  filterOk: boolean
}
export interface LogsDef {
  title: string
  columns: string[]
  query: string | null
  filter: Record<string, string | string[]>
  ok: boolean
}
export interface DashboardDef {
  id: string
  title: string
  slug: string
  legacySlug?: string
  group: string
  description: string
  logs: LogsDef | null
  panels: PanelDef[]
}

const base = raw as unknown as { commonFields: string[]; dashboards: DashboardDef[] }
// The address of each dashboard carries the new product names; the old address still opens it.
export const catalog: { commonFields: string[]; dashboards: DashboardDef[] } = { ...base, dashboards: base.dashboards.map((d) => ({ ...d, legacySlug: d.slug, slug: niceSlug(d.slug) })) }
export const groups = ['General', 'Protocols', 'ICS/IoT', 'Other']
export const findDashboard = (slug?: string) => catalog.dashboards.find((d) => d.slug === slug || d.legacySlug === slug)
