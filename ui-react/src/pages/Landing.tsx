import { labelOf } from '../data/components'
import { Link } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { getJSON } from '../api'
import RangeSelect from '../components/RangeSelect'
import { rangeLabel, rangeParams } from '../lib/query'
import { AppConfig, defaultConfig, loadConfig } from '../config'

const UI = import.meta.env.BASE_URL

interface Tile {
  href: string
  title: string
  desc: ReactNode
  img?: string
  icon?: string
}

const FALLBACK: Record<string, string> = { 'LogAnalytics Engine': '📊', 'PacketVault': '🔍', 'DataDecoder Workbench': '🧪', 'AssetRegistry': '🗺️' }

// Product icon from the server's /assets/img when it exists, an emoji tile otherwise.
function TileIcon({ img, icon }: { img?: string; icon: string }) {
  const [broken, setBroken] = useState(false)
  return img && !broken ? <img src={img} alt="" onError={() => setBroken(true)} /> : <span className="tile-icon">{icon}</span>
}

const TILE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#818cf8']

function buildTiles(c: AppConfig): Tile[] {
  return [
    {
      href: `${UI}dashboards`,
      title: labelOf('OpenSearch')!,
      icon: '📊',
      desc: '',
    },
    {
      href: `${UI}sessions`,
      title: labelOf('Arkime')!,
      icon: '🔍',
      desc: '',
    },
    { href: `${UI}assets`, title: labelOf('NetBox')!, icon: '🗺️', desc: '' },
    {
      href: '/packetvault/cyberchef.html',
      title: labelOf('CyberChef')!,
      icon: '🧪',
      desc: '',
    },
    { href: '/readme/', title: 'Documentation', icon: '📖', desc: 'Read the user guide' },
    {
      href: `${UI}upload`,
      title: labelOf('FilePond')!,
      icon: '⬆️',
      desc: '',
    },
    { href: /^\/auth\/?$/.test(c.authUrl) ? `${UI}accounts` : c.authUrl, title: labelOf('Keycloak')!, icon: '👤', desc: '' },
    {
      href: `${UI}files`,
      title: labelOf('Strelka')!,
      icon: '🗄️',
      desc: '',
    },
  ]
}

export default function Landing() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [range, setRange] = useState('7d')
  const [total, setTotal] = useState<number | null>(null)
  const [top, setTop] = useState<{ k: string; n: number }[]>([])
  useEffect(() => {
    let alive = true
    const { from, to } = rangeParams(range)
    setTotal(null)
    getJSON('/mapi/document', { from, to, limit: 0, track_total_hits: 'true' })
      .then((x) => alive && setTotal(typeof x?.total === 'object' && x.total ? x.total.value : (x?.total ?? 0)))
      .catch(() => undefined)
    getJSON('/mapi/agg/event.dataset', { from, to, limit: 5 })
      .then((x) => alive && setTop((x?.['event.dataset']?.buckets ?? []).map((b: any) => ({ k: String(b.key), n: b.doc_count }))))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [range])
  useEffect(() => {
    loadConfig().then(setConfig)
  }, [])

  return (
    <>
      <div className="ov-hero home-hero">
        <div>
          <h2>Sampark SOC Tool</h2>
          <p>Network traffic analysis and security monitoring — dashboards, sessions, hunts, assets and alerting in one place.</p>
          <div className="hero-actions">
            <Link to="/dashboards" className="btn">Open dashboards</Link>
            <Link to="/management" className="btn ghost">Management overview</Link>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="row-between">
          <h3>Activity</h3>
          <RangeSelect value={range} onChange={setRange} />
        </div>
        <p>
          <b>{total === null ? '…' : total.toLocaleString()}</b> events {rangeLabel(range).toLowerCase()}
          {top.length ? ' — top sources: ' + top.map((t) => `${t.k} (${t.n.toLocaleString()})`).join(', ') : ''}
        </p>
      </div>
      <div className="tile-grid">
        {buildTiles(config).map((t, i) => (
          <div className="card tile" key={t.title} style={{ ['--c' as any]: TILE_COLORS[i % TILE_COLORS.length] }}>
            <a className="tile-head" href={t.href}>
              <TileIcon img={t.img} icon={t.icon ?? FALLBACK[t.title] ?? '🛡️'} />
              <h3>{t.title}</h3>
            </a>
            {t.desc ? <p>{t.desc}</p> : null}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>More tools, built in</h3>
        <p className="muted small">Saved objects, indices, alerting monitors, anomaly detectors and a query console.</p>
        <div className="status-links">
          <Link to="/management">Management</Link>
          <Link to="/console">Console</Link>
        </div>
      </div>
      <div className="status-links">
        <a href="/mapi/ready">Service readiness</a>
        <a href="/mapi/ingest-stats">Ingest statistics</a>
        <a href="/mapi/">REST API</a>
        {config.version && <span className="muted">Version {config.version}</span>}
      </div>
    </>
  )
}
