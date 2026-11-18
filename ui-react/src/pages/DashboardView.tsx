import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EventTable from '../components/EventTable'
import PanelView from '../components/PanelView'
import { catalog, DashboardDef, findDashboard } from '../data/catalog'
import { describeFilter, Filters } from '../lib/query'
import RangeSelect from '../components/RangeSelect'

const ACCENT: Record<string, string> = { General: '#38bdf8', Protocols: '#34d399', 'ICS/IoT': '#fb923c', Other: '#a78bfa' }

// Left navigation in the same order as the original dashboards' Navigation panel.
const GENERAL_ORDER = ['Overview', 'Security Overview', 'ICS/IoT Security Overview', 'Severity', 'Connections', 'IP Connections Tree', 'Multicast', 'Biomes', 'Actions and Results', 'Threat Intelligence', 'Files', 'File Scanning', 'File Tree', 'Executables', 'Software', 'Zeek Known Summary', 'Zeek Notices', 'Zeek Weird', 'Zeek Signatures', 'Suricata Alerts', 'Asset Interaction Analysis']
const byTitle = (a: DashboardDef, b: DashboardDef) => a.title.localeCompare(b.title)
const NAV = (() => {
  const all = catalog.dashboards
  const general = GENERAL_ORDER.map((t) => all.find((d) => d.title === t)).filter((d): d is DashboardDef => !!d)
  const used = new Set(general.map((d) => d.id))
  const rest = all.filter((d) => !used.has(d.id))
  return [
    { label: 'General Network Logs', items: general },
    { label: 'Common Protocols', items: rest.filter((d) => d.group === 'Protocols').sort(byTitle) },
    { label: 'ICS/IoT Protocols', items: rest.filter((d) => d.group === 'ICS/IoT').sort(byTitle) },
    { label: 'Other', items: rest.filter((d) => d.group !== 'Protocols' && d.group !== 'ICS/IoT').sort(byTitle) },
  ].filter((g) => g.items.length)
})()

export default function DashboardView({ def }: { def?: DashboardDef }) {
  const { slug } = useParams()
  const dash = def ?? findDashboard(slug)
  const [range, setRange] = useState('1h')
  const [user, setUser] = useState<Filters>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [every, setEvery] = useState(0) // auto-refresh seconds (0 = off)
  useEffect(() => {
    if (!every) return
    const t = setInterval(() => setRefreshKey((k) => k + 1), every * 1000)
    return () => clearInterval(t)
  }, [every])

  const onPick = useCallback((field: string, value: string, negate = false) => {
    setUser((f) => {
      const key = negate ? `!${field}` : field
      const { [negate ? field : `!${field}`]: _other, ...rest } = f // a value can't be both included and excluded
      return { ...rest, [key]: value }
    })
  }, [])

  if (!dash)
    return (
      <section className="card error-page">
        <h2>Dashboard not found</h2>
        <p>
          <Link to="/dashboards">Back to all dashboards</Link>
        </p>
      </section>
    )

  const base: Filters = { ...(dash.logs?.filter ?? {}), ...user }
  const onClear = (field: string) => setUser(({ [field]: _x, ...rest }) => rest)
  const ctx = { range, base, refreshKey, onPick, onClear }
  // Region maps become country bar lists (document counts; the API has no sum/max aggregations).
  const panels = dash.panels.map((p) =>
    p.vis === 'region_map' && p.fields.length
      ? { ...p, kind: 'terms' as const, title: p.title.replace(/ \(region map\)/i, '') + ' — by country (document count)' }
      : p,
  )
  const alertish = /suricata|security|alert|severity|threat|notice|weird|signature/i.test(dash.slug)
  const accent = alertish ? '#f87171' : ACCENT[dash.group] ?? '#38bdf8'
  const metrics = panels.filter((p) => p.kind === 'metric')
  const times = panels.filter((p) => p.kind === 'time')
  const terms = panels.filter((p) => p.kind === 'terms')
  const simple = terms.filter((p) => new Set(p.fields).size <= 1)
  const multi = terms.filter((p) => new Set(p.fields).size > 1)
  const controls = panels.filter((p) => p.kind === 'controls')
  const flows = panels.filter((p) => p.kind === 'sankey' || p.kind === 'tree' || p.kind === 'filetree')
  const skipped = panels.filter((p) => p.kind === 'unsupported').length

  return (
    <div className="dash-layout">
      <aside className="dash-nav" aria-label="Dashboards">
        <h3>Navigation</h3>
        {NAV.map(({ label, items }) => (
          <div key={label}>
            <h4>{label}</h4>
            <ul>
              {items.map((d) => (
                <li key={d.id}>
                  <Link to={`/dashboards/${d.slug}`} className={d.id === dash.id ? 'active' : ''}>{d.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>
      <div className="dash-main" style={{ ['--dc' as any]: accent }}>
        <header className="dash-hero">
          <span className="dash-hero-icon" aria-hidden="true">{alertish ? '🚨' : '📊'}</span>
          <div className="dash-hero-text">
            <div className="dash-crumb"><Link to="/dashboards">Dashboards</Link> <span>›</span> <em>{dash.group === 'General' ? 'General Network Logs' : dash.group === 'Protocols' ? 'Common Protocols' : dash.group === 'ICS/IoT' ? 'ICS/IoT Protocols' : 'Other'}</em></div>
            <h1>{dash.title}</h1>
            {dash.description && <p className="dash-desc">{dash.description}</p>}
          </div>
          <div className="toolbar dash-tools">
            <RangeSelect value={range} onChange={setRange} />
            <select value={every} onChange={(e) => setEvery(Number(e.target.value))} aria-label="Auto refresh">
              <option value={0}>Auto-refresh off</option>
              <option value={30}>Every 30 s</option>
              <option value={60}>Every 1 min</option>
              <option value={300}>Every 5 min</option>
            </select>
            <button className="btn" onClick={() => setRefreshKey((k) => k + 1)}>
              Update
            </button>
            <Link to={`/management/dashboard/${dash.id}`} className="pill-link">Definition</Link>
          </div>
        </header>
      {(Object.keys(user).length > 0 || (dash.logs && Object.keys(dash.logs.filter).length > 0)) && (
        <div className="chips">
          {Object.entries(dash.logs?.filter ?? {}).map(([k, v]) => (
            <span className="tag locked" key={`s-${k}`} title="Part of this dashboard's saved search">
              {describeFilter(k, v)}
            </span>
          ))}
          {Object.entries(user).map(([k, v]) => (
            <span className="tag" key={k}>
              {describeFilter(k, v)}
              <button type="button" aria-label={`Remove filter ${k}`} onClick={() => setUser(({ [k]: _d, ...rest }) => rest)}>
                ×
              </button>
            </span>
          ))}
          {Object.keys(user).length > 0 && (
            <button className="link" onClick={() => setUser({})}>
              Clear filters
            </button>
          )}
        </div>
      )}
      {dash.logs && !dash.logs.ok && (
        <p className="muted small">
          Part of this dashboard's saved search ({dash.logs.query}) can't be expressed through the API, so counts may be broader than the original.
        </p>
      )}


        <div className="dash-grid">
          {controls.map((p, i) => (
            <div key={`c${i}`} className="gp gp-12">
              <PanelView p={p} ctx={ctx} />
            </div>
          ))}
          {metrics.map((p, i) => (
            <div key={`m${i}`} className="gp gp-3">
              <PanelView p={p} ctx={ctx} />
            </div>
          ))}
          {times.map((p, i) => (
            <div key={`t${i}`} className={`gp ${metrics.length === 1 && times.length === 1 ? 'gp-9' : 'gp-12'}`}>
              <PanelView p={p} ctx={ctx} />
            </div>
          ))}
          {flows.map((p, i) => (
            <div key={`f${i}`} className="gp gp-12">
              <PanelView p={p} ctx={ctx} />
            </div>
          ))}
          {simple.length > 0 && (
            <div className="gp gp-12 masonry">
              {simple.map((p, i) => (
                <div key={`p${i}`} className="mi">
                  <PanelView p={p} ctx={ctx} />
                </div>
              ))}
            </div>
          )}
          {multi.map((p, i) => (
            <div key={`x${i}`} className={`gp ${multi.length % 2 === 1 && i === multi.length - 1 ? 'gp-12' : 'gp-6'}`}>
              <PanelView p={p} ctx={ctx} />
            </div>
          ))}
          {dash.logs && (
            <div className="gp gp-12">
              <EventTable title={dash.logs.title || 'Logs'} columns={dash.logs.columns} range={range} base={base} refreshKey={refreshKey} onPick={onPick} />
            </div>
          )}
        </div>
      {skipped > 0 && (
        <p className="muted small" style={{ marginTop: '1rem' }}>
          {skipped} map/custom visualization{skipped > 1 ? 's' : ''} from the original dashboard {skipped > 1 ? 'are' : 'is'} not shown here (see the dashboard's definition under Management).
        </p>
      )}
      </div>
    </div>
  )
}
