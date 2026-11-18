import { useEffect, useMemo, useState } from 'react'
import RangeSelect from '../components/RangeSelect'
import { inRange } from '../lib/query'
import { Link } from 'react-router-dom'
import { catalog } from '../data/catalog'

// Management > Dashboards: every saved dashboard on the server as a searchable card gallery.
interface Card {
  id: string
  title: string
  description: string
  updated: string
  panels: number
  group: string
  to: string
}
const GROUPS = ['All', 'General', 'Protocols', 'ICS/IoT', 'Other', 'Custom'] as const
const COLORS: Record<string, string> = { General: '#38bdf8', Protocols: '#34d399', 'ICS/IoT': '#fb923c', Other: '#a78bfa', Custom: '#f472b6' }
type Sort = 'name' | 'recent' | 'panels'

export default function ManagementDashboards() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('All')
  const [sort, setSort] = useState<Sort>('name')
  const [range, setRange] = useState('all')

  useEffect(() => {
    let alive = true
    fetch('/dashboards/api/saved_objects/_find?type=dashboard&per_page=500&fields=title&fields=description', { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((r) => {
        if (!alive) return
        setCards(
          (r?.saved_objects ?? []).map((o: any): Card => {
            const known = catalog.dashboards.find((d) => d.id === o.id)
            return {
              id: o.id,
              title: o.attributes?.title ?? o.id,
              description: o.attributes?.description ?? known?.description ?? '',
              updated: o.updated_at ?? '',
              panels: (o.references ?? []).length,
              group: known?.group ?? 'Custom',
              to: known ? `/dashboards/${known.slug}` : `/dashboards/saved/${encodeURIComponent(o.id)}`,
            }
          }),
        )
      })
      .catch((e) => alive && setError(e?.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [])

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: cards?.length ?? 0 }
    for (const c of cards ?? []) m[c.group] = (m[c.group] ?? 0) + 1
    return m
  }, [cards])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = (cards ?? []).filter((c) => (group === 'All' || c.group === group) && inRange(c.updated, range) && (!t || c.title.toLowerCase().includes(t) || c.description.toLowerCase().includes(t)))
    list.sort((a, b) => (sort === 'recent' ? b.updated.localeCompare(a.updated) : sort === 'panels' ? b.panels - a.panels : a.title.localeCompare(b.title)))
    return list
  }, [cards, q, group, sort, range])

  return (
    <div className="dg">
      <div className="dg-bar">
        <input className="dg-search" placeholder="Search dashboards by name or description…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort dashboards">
          <option value="name">Name A–Z</option>
          <option value="recent">Recently updated</option>
          <option value="panels">Most panels</option>
        </select>
        <RangeSelect value={range} onChange={setRange} label="Updated within" />
      </div>
      <div className="dg-chips">
        {GROUPS.filter((g) => g === 'All' || counts[g]).map((g) => (
          <button key={g} className={group === g ? 'on' : ''} style={{ ['--c' as any]: COLORS[g] ?? '#38bdf8' }} onClick={() => setGroup(g)}>
            {g} <span>{counts[g] ?? 0}</span>
          </button>
        ))}
        <span className="dg-count">{cards ? `${shown.length} of ${cards.length} dashboards` : 'Loading…'}</span>
      </div>
      {error && <p className="err">Could not load dashboards: {error}</p>}
      <div className="dg-grid">
        {shown.map((c) => (
          <article key={c.id} className="dg-card" style={{ ['--c' as any]: COLORS[c.group] ?? '#38bdf8' }}>
            <div className="dg-head">
              <span className="dg-badge">{c.title.trim().charAt(0).toUpperCase()}</span>
              <div>
                <Link to={c.to} className="dg-title">{c.title}</Link>
                <span className="dg-group">{c.group}</span>
              </div>
            </div>
            <p className="dg-desc">{c.description ? (c.description.length > 120 ? `${c.description.slice(0, 120)}…` : c.description) : 'No description.'}</p>
            <div className="dg-meta">
              <span title="Panels on this dashboard">▦ {c.panels} panels</span>
              <span>{c.updated ? new Date(c.updated).toLocaleDateString() : ''}</span>
            </div>
            <div className="dg-actions">
              <Link to={c.to} className="dg-open">Open</Link>
              <Link to={`/management/dashboard/${encodeURIComponent(c.id)}`}>Details</Link>
            </div>
          </article>
        ))}
      </div>
      {cards && shown.length === 0 && <p className="muted">No dashboards match “{q}”.</p>}
    </div>
  )
}
