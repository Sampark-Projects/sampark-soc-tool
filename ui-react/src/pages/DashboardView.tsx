import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
// Section names used to split the long lists into smaller groups that open when clicked.
const GENERAL_SECTIONS: [string, string[]][] = [
  ['Overview', ['Overview', 'Security Overview', 'ICS/IoT Security Overview', 'Severity']],
  ['Network', ['Connections', 'IP Connections Tree', 'Multicast', 'Biomes', 'Actions and Results', 'Asset Interaction Analysis']],
  ['Threats and alerts', ['Threat Intelligence', 'Suricata Alerts', 'Zeek Notices', 'Zeek Weird', 'Zeek Signatures']],
  ['Files', ['Files', 'File Scanning', 'File Tree', 'Executables']],
  ['Inventory', ['Software', 'Zeek Known Summary']],
]
const PROTOCOL_SECTIONS: [string, string[]][] = [
  ['Web and remote access', ['HTTP', 'WebSocket', 'SSH', 'Telnet, rlogin and rsh', 'RDP', 'RFB', 'FTP', 'TFTP', 'SIP', 'IRC', 'SMTP', 'QUIC', 'Tunnels', 'STUN']],
  ['Sign-in and certificates', ['LDAP', 'Kerberos', 'NTLM', 'RADIUS', 'SSL', 'X.509']],
  ['Databases', ['MySQL', 'PostgreSQL', 'Redis', 'Tabular Data Stream', 'Tabular Data Stream - RPC', 'Tabular Data Stream - SQL']],
  ['Network services', ['DNS', 'DHCP', 'NTP', 'SNMP', 'OSPF', 'Syslog', 'SMB', 'DCE/RPC', 'MQTT']],
]
interface NavSection { label: string; items: DashboardDef[] }
interface NavGroupDef { label: string; sections: NavSection[] }
const NAV: NavGroupDef[] = (() => {
  const all = catalog.dashboards
  const used = new Set<string>()
  const split = (defs: [string, string[]][], pool: DashboardDef[]): NavSection[] => {
    const out: NavSection[] = defs
      .map(([label, titles]) => ({ label, items: titles.map((t) => pool.find((d) => d.title === t)).filter((d): d is DashboardDef => !!d) }))
      .filter((x) => x.items.length)
    out.forEach((x) => x.items.forEach((d) => used.add(d.id)))
    const left = pool.filter((d) => !used.has(d.id)).sort(byTitle)
    if (left.length) out.push({ label: 'More', items: left })
    left.forEach((d) => used.add(d.id))
    return out
  }
  const generalPool = all.filter((d) => GENERAL_ORDER.includes(d.title))
  const general = split(GENERAL_SECTIONS, generalPool)
  const proto = split(PROTOCOL_SECTIONS, all.filter((d) => d.group === 'Protocols'))
  const rest = all.filter((d) => !used.has(d.id))
  return [
    { label: 'General Network Logs', sections: general },
    { label: 'Common Protocols', sections: proto },
    { label: 'ICS/IoT Protocols', sections: [{ label: '', items: rest.filter((d) => d.group === 'ICS/IoT').sort(byTitle) }] },
    { label: 'Other', sections: [{ label: '', items: rest.filter((d) => d.group !== 'ICS/IoT').sort(byTitle) }] },
  ].filter((g) => g.sections.some((x) => x.items.length))
})()

// one group of the left list: its title is a button, its items only show while it is open
function NavToggle({ id, label, count, open, onToggle, level = 1, children }: { id: string; label: string; count: number; open: boolean; onToggle: (id: string) => void; level?: 1 | 2; children: ReactNode }) {
  return (
    <div className={`nav-group lvl${level}`}>
      <button type="button" className="nav-toggle" aria-expanded={open} onClick={() => onToggle(id)}>
        <span className="nav-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="nav-label">{label}</span>
        <span className="nav-count">{count}</span>
      </button>
      {open && children}
    </div>
  )
}

export default function DashboardView({ def }: { def?: DashboardDef }) {
  const { slug } = useParams()
  const dash = def ?? findDashboard(slug)
  const [range, setRange] = useState('7d')
  const [user, setUser] = useState<Filters>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [every, setEvery] = useState(0) // auto-refresh seconds (0 = off)
  // which left-list groups are open: the one holding the dashboard on screen always opens, others open when clicked
  const [openNav, setOpenNav] = useState<Set<string>>(new Set())
  const toggleNav = useCallback((id: string) => setOpenNav((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n }), [])
  const activeId = def?.id ?? findDashboard(slug)?.id
  useEffect(() => {
    if (!activeId) return
    setOpenNav((o) => {
      const n = new Set(o)
      NAV.forEach((g) => g.sections.forEach((sec) => { if (sec.items.some((d) => d.id === activeId)) { n.add(g.label); if (sec.label) n.add(`${g.label}/${sec.label}`) } }))
      return n
    })
  }, [activeId])
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
        {NAV.map((g) => (
          <NavToggle key={g.label} id={g.label} label={g.label} count={g.sections.reduce((n, x) => n + x.items.length, 0)} open={openNav.has(g.label)} onToggle={toggleNav}>
            {g.sections.map((sec) => {
              const list = (
                <ul>
                  {sec.items.map((d) => (
                    <li key={d.id}>
                      <Link to={`/dashboards/${d.slug}`} className={d.id === dash?.id ? 'active' : ''}>{d.title}</Link>
                    </li>
                  ))}
                </ul>
              )
              return sec.label ? (
                <NavToggle key={sec.label} id={`${g.label}/${sec.label}`} label={sec.label} count={sec.items.length} open={openNav.has(`${g.label}/${sec.label}`)} onToggle={toggleNav} level={2}>
                  {list}
                </NavToggle>
              ) : (
                <div key="all">{list}</div>
              )
            })}
          </NavToggle>
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
