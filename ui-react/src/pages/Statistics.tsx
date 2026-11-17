import { useCallback, useEffect, useState } from 'react'
import { formatBytes, getJSON, pick } from '../api'
import PageHero from '../components/PageHero'

// Arkime capture-node statistics: GET /arkime/api/stats. Field names vary by Arkime version,
// so each column tries several keys.
const num = (v: unknown) => (v == null || v === '' ? '—' : Number(v).toLocaleString())

export default function Statistics() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getJSON('/arkime/api/stats', { length: 100, start: 0, sortField: 'nodeName', desc: 'false' })
      .then((r) => {
        setRows(r?.data ?? [])
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    if (!auto) return
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load, auto])

  const totalSessions = rows.reduce((a, r) => a + (Number(pick(r, ['totalSessions'])) || 0), 0)
  const totalPackets = rows.reduce((a, r) => a + (Number(pick(r, ['totalPackets'])) || 0), 0)

  const pps = rows.reduce((a, r) => a + (Number(pick(r, ['deltaPacketsPerSec'])) || 0), 0)

  return (
    <>
      <PageHero icon="📈" title="Statistics" sub="Capture-node health: sessions, packet rates, drops and free disk space." href="/arkime/stats" linkLabel="Open PCAP & Indexing Stats ↗">
        <label className="muted small">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh (15 s)
        </label>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </PageHero>
      {error && <p className="err">Could not load statistics: {error}</p>}
      <div className="ov-kpis">
        <div className="ov-kpi" style={{ ['--c' as any]: '#38bdf8' }}><span className="ov-kpi-label">Capture nodes</span><span className="ov-kpi-value">{rows.length}</span></div>
        <div className="ov-kpi" style={{ ['--c' as any]: '#34d399' }}><span className="ov-kpi-label">Total sessions</span><span className="ov-kpi-value">{totalSessions.toLocaleString()}</span></div>
        <div className="ov-kpi" style={{ ['--c' as any]: '#818cf8' }}><span className="ov-kpi-label">Total packets</span><span className="ov-kpi-value">{totalPackets.toLocaleString()}</span></div>
        <div className="ov-kpi" style={{ ['--c' as any]: '#fb923c' }}><span className="ov-kpi-label">Packets / second</span><span className="ov-kpi-value">{pps.toLocaleString()}</span></div>
      </div>
      <div className="card table-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Node</th>
              <th>Sessions</th>
              <th>Packets</th>
              <th>Packets/s</th>
              <th>Bytes/s</th>
              <th>Dropped</th>
              <th>Free space</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {loading ? 'Loading…' : 'No capture nodes reported'}
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const free = Number(pick(r, ['freeSpaceM']))
              const seen = Number(pick(r, ['currentTime']))
              return (
                <tr key={String(pick(r, ['nodeName', 'id'])) + i}>
                  <td>{String(pick(r, ['nodeName', 'id']) ?? '—')}</td>
                  <td>{num(pick(r, ['totalSessions']))}</td>
                  <td>{num(pick(r, ['totalPackets']))}</td>
                  <td>{num(pick(r, ['deltaPacketsPerSec']))}</td>
                  <td>{pick(r, ['deltaBytesPerSec']) == null ? '—' : formatBytes(Number(pick(r, ['deltaBytesPerSec'])))}</td>
                  <td>{num(pick(r, ['deltaDroppedPerSec', 'deltaOverloadDroppedPerSec']))}</td>
                  <td>{Number.isFinite(free) ? formatBytes(free * 1024 * 1024) : '—'}</td>
                  <td>{Number.isFinite(seen) && seen > 0 ? new Date(seen * 1000).toLocaleString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
