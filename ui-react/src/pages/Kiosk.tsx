import { useCallback, useEffect, useState } from 'react'
import PageHero from '../components/PageHero'

// Talks to the existing kiosk Flask app (malcolm-iso/kiosk/interface/routes.py):
//   GET  /update                -> system stats (takes ~1s: it samples I/O over 1 second)
//   POST /script_call/<command> -> start --quiet | stop | status | wipe
// Set VITE_KIOSK_API (e.g. "/kiosk-api") if the Flask app is mounted under a prefix.
const API = import.meta.env.VITE_KIOSK_API ?? ''
const POLL_MS = 3000

interface Disk { mount: string; total: number; used: number; percent: number }
interface Stats {
  cpu: { percent: number }
  ram: { percent: number; total: number; used: number }
  disks: Disk[]
  disk_io: { read_bytes_sec: number; write_bytes_sec: number }
  net_io: { sent_bytes_sec: number; received_bytes_sec: number }
  zeek: Record<string, number>
  pcap: number
  suricata: number
}

function bytes(n: number) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1)
  return `${(n / 1024 ** i).toFixed(1)} ${u[i]}`
}

function Meter({ label, percent, detail }: { label: string; percent: number; detail?: string }) {
  const level = percent >= 90 ? 'crit' : percent >= 75 ? 'warn' : ''
  return (
    <div className="card meter" data-level={level}>
      <div className="meter-head">
        <span>{label}</span>
        <strong>{percent.toFixed(0)}%</strong>
      </div>
      <div className="progress">
        <div className={level} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      {detail && <small className="muted">{detail}</small>}
    </div>
  )
}

const actions = [
  { cmd: 'start --quiet', label: 'Start', desc: 'Start all services', confirm: false },
  { cmd: 'stop', label: 'Stop', desc: 'Stop all services', confirm: true },
  { cmd: 'status', label: 'Status', desc: 'Display sensor service status', confirm: false },
  { cmd: 'wipe', label: 'Clean', desc: 'Remove captured data', confirm: true },
]

export default function Kiosk() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let timer: number
    const tick = async () => {
      try {
        const r = await fetch(`${API}/update`)
        if (!r.ok) throw new Error(String(r.status))
        const data = await r.json()
        if (alive) {
          setStats(data)
          setError(false)
        }
      } catch {
        if (alive) setError(true)
      }
      if (alive) timer = window.setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  const run = useCallback(async (a: (typeof actions)[number]) => {
    if (a.confirm && !window.confirm(`${a.label}: ${a.desc}. Are you sure?`)) return
    setBusy(true)
    try {
      const r = await fetch(`${API}/script_call/${encodeURIComponent(a.cmd)}`, { method: 'POST' })
      const data = await r.json().catch(() => ({}))
      setResult(
        data.success ? data.output ?? 'Success' : [data.err, data.out].filter(Boolean).join('\n') || `Failed (HTTP ${r.status})`,
      )
    } catch (e) {
      setResult(`Request failed: ${e}`)
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <>
      <PageHero icon="🖥️" title="Sensor Dashboard" sub="Live CPU, memory, disk and network load of this sensor, plus start / stop controls." />
      {error && <p className="err">Cannot reach the kiosk service. Retrying…</p>}

      {stats ? (
        <>
          <div className="tile-grid">
            <Meter label="CPU" percent={stats.cpu.percent} />
            <Meter label="Memory" percent={stats.ram.percent} detail={`${bytes(stats.ram.used)} of ${bytes(stats.ram.total)}`} />
            {stats.disks.map((d) => (
              <Meter key={d.mount} label={`Disk ${d.mount}`} percent={d.percent} detail={`${bytes(d.used)} of ${bytes(d.total)}`} />
            ))}
          </div>

          <div className="tile-grid" style={{ marginTop: '1rem' }}>
            <div className="card">
              <h3>Network I/O</h3>
              <p>⬆ {bytes(stats.net_io.sent_bytes_sec)}/s</p>
              <p>⬇ {bytes(stats.net_io.received_bytes_sec)}/s</p>
            </div>
            <div className="card">
              <h3>Disk I/O</h3>
              <p>Read {bytes(stats.disk_io.read_bytes_sec)}/s</p>
              <p>Write {bytes(stats.disk_io.write_bytes_sec)}/s</p>
            </div>
            <div className="card">
              <h3>Captures</h3>
              <p>Latest PCAP: {bytes(stats.pcap)}</p>
              <p>IDS/IPS/NSM Engine alerts/events: {stats.suricata.toLocaleString()}</p>
            </div>
            <div className="card">
              <h3>Top Traffic Monitoring logs</h3>
              {Object.entries(stats.zeek).length === 0 && <p className="muted">No logs yet</p>}
              {Object.entries(stats.zeek).map(([k, v]) => (
                <p key={k} className="row-between">
                  <span>{k}</span>
                  <span>{v.toLocaleString()}</span>
                </p>
              ))}
            </div>
          </div>
        </>
      ) : (
        !error && <p className="muted">Loading…</p>
      )}

      <h2>Controls</h2>
      <div className="tile-grid">
        {actions.map((a) => (
          <div className="card tile" key={a.cmd}>
            <h3>Sensor {a.label}</h3>
            <p>{a.desc}</p>
            <button className={`btn${a.label === 'Clean' || a.label === 'Stop' ? ' danger' : ''}`} disabled={busy} onClick={() => run(a)}>
              {a.label}
            </button>
          </div>
        ))}
      </div>

      {(busy || result !== null) && (
        <div className="modal-backdrop" onClick={() => !busy && setResult(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>System Response</h3>
            {busy ? <p>Working…</p> : <pre>{result}</pre>}
            {!busy && (
              <button className="btn" onClick={() => setResult(null)}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
