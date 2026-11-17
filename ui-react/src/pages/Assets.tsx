import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getJSON } from '../api'
import PageHero from '../components/PageHero'

// Native asset browser on the NetBox REST API (list endpoints return {count, results}):
//   GET /netbox/api/<path>/?q=<search>&limit=&offset=
const PAGE = 50

type Row = Record<string, any>
interface Tab {
  id: string
  label: string
  path: string
  ui: string // NetBox UI path for "open in NetBox"
  columns: { head: string; cell: (r: Row) => string }[]
}

const name = (v: any) => (v == null ? '' : typeof v === 'object' ? v.display ?? v.name ?? v.label ?? v.value ?? v.model ?? v.address ?? '' : String(v))

const TABS: Tab[] = [
  {
    id: 'devices',
    label: 'Devices',
    path: '/netbox/api/dcim/devices/',
    ui: '/netbox/dcim/devices/',
    columns: [
      { head: 'Name', cell: (r) => name(r.name ?? r.display) },
      { head: 'Role', cell: (r) => name(r.role ?? r.device_role) },
      { head: 'Type', cell: (r) => name(r.device_type) },
      { head: 'Site', cell: (r) => name(r.site) },
      { head: 'Status', cell: (r) => name(r.status) },
      { head: 'Primary IP', cell: (r) => name(r.primary_ip) },
    ],
  },
  {
    id: 'ips',
    label: 'IP Addresses',
    path: '/netbox/api/ipam/ip-addresses/',
    ui: '/netbox/ipam/ip-addresses/',
    columns: [
      { head: 'Address', cell: (r) => name(r.address) },
      { head: 'Status', cell: (r) => name(r.status) },
      { head: 'DNS name', cell: (r) => name(r.dns_name) },
      { head: 'Assigned to', cell: (r) => name(r.assigned_object) },
      { head: 'Description', cell: (r) => name(r.description) },
    ],
  },
  {
    id: 'prefixes',
    label: 'Prefixes',
    path: '/netbox/api/ipam/prefixes/',
    ui: '/netbox/ipam/prefixes/',
    columns: [
      { head: 'Prefix', cell: (r) => name(r.prefix) },
      { head: 'Status', cell: (r) => name(r.status) },
      { head: 'Site', cell: (r) => name(r.site ?? r.scope) },
      { head: 'VLAN', cell: (r) => name(r.vlan) },
      { head: 'Description', cell: (r) => name(r.description) },
    ],
  },
  {
    id: 'sites',
    label: 'Sites',
    path: '/netbox/api/dcim/sites/',
    ui: '/netbox/dcim/sites/',
    columns: [
      { head: 'Name', cell: (r) => name(r.name) },
      { head: 'Status', cell: (r) => name(r.status) },
      { head: 'Region', cell: (r) => name(r.region) },
      { head: 'Devices', cell: (r) => String(r.device_count ?? '') },
      { head: 'Description', cell: (r) => name(r.description) },
    ],
  },
]

export default function Assets() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(TABS.find((t) => t.id === params.get('tab')) ?? TABS[0])
  const [rows, setRows] = useState<Row[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [applied, setApplied] = useState(params.get('q') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getJSON(tab.path, { limit: PAGE, offset: page * PAGE, q: applied || undefined })
      setRows(r.results ?? [])
      setCount(r.count ?? 0)
    } catch (e: any) {
      setError(e.message ?? String(e))
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [tab, page, applied])

  useEffect(() => {
    load()
  }, [load])

  const pages = Math.max(1, Math.ceil(count / PAGE))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setApplied(q.trim())
  }

  return (
    <>
      <PageHero icon="🗺️" title="Assets" sub="Devices, IP addresses, prefixes and sites tracked in IRM/IPAM/DCIM." href="/netbox/" linkLabel="Open full IRM/IPAM/DCIM ↗" />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab.id ? 'active' : ''}
            onClick={() => {
              setTab(t)
              setPage(0)
              setApplied('')
              setQ('')
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="toolbar card" onSubmit={submit}>
        <input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${tab.label.toLowerCase()}`} aria-label="Search" />
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      {error &&
        (/HTTP (404|502|503)/.test(error) ? (
          <p className="err">
            IRM/IPAM/DCIM does not seem to be running on this server ({error}). Check that it is enabled in its configuration and that its container is up.
          </p>
        ) : (
          <p className="err">Could not load {tab.label.toLowerCase()}: {error}</p>
        ))}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {tab.columns.map((c) => (
                <th key={c.head}>{c.head}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={tab.columns.length + 1} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={tab.columns.length + 1} className="muted">
                  Nothing found
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                {tab.columns.map((c) => (
                  <td key={c.head}>{c.cell(r)}</td>
                ))}
                <td>
                  <Link to={`/assets/${tab.id}/${r.id}`}>Details</Link>
                  {' · '}
                  <a href={`${tab.ui}${r.id}/`}>IRM/IPAM/DCIM ↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="toolbar" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
        <span className="muted">{count.toLocaleString()} total</span>
        <span>
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Prev
          </button>{' '}
          <span className="muted">
            Page {page + 1} / {pages}
          </span>{' '}
          <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </span>
      </div>
    </>
  )
}
