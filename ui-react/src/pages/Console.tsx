import { useState } from 'react'
import { osProxy } from '../api'
import RangeSelect from '../components/RangeSelect'
import { resolveRange } from '../lib/query'

// Local counterpart of Dev Tools: send a request to the search engine and read the answer.
const PRESETS: { label: string; method: string; path: string; body: string }[] = [
  { label: 'Cluster health', method: 'GET', path: '_cluster/health', body: '' },
  { label: 'Indices', method: 'GET', path: '_cat/indices?v&s=index', body: '' },
  { label: 'Latest 5 sessions', method: 'GET', path: 'arkime_sessions3-*/_search', body: '{\n  "size": 5,\n  "sort": [{ "firstPacket": "desc" }],\n  "query": __Q__\n}' },
  { label: 'Count by protocol', method: 'GET', path: 'arkime_sessions3-*/_search', body: '{\n  "size": 0,\n  "query": __Q__,\n  "aggs": { "p": { "terms": { "field": "network.protocol", "size": 10 } } }\n}' },
  { label: 'Alerting monitors', method: 'GET', path: '_plugins/_alerting/monitors/_search', body: '{ "size": 50, "query": { "match_all": {} } }' },
  { label: 'Anomaly detectors', method: 'GET', path: '_plugins/_anomaly_detection/detectors/_search', body: '{ "size": 50, "query": { "match_all": {} } }' },
  { label: 'Notification channels', method: 'GET', path: '_plugins/_notifications/configs', body: '' },
]
const READ_ONLY = /_search|_count|_cat\/|_cluster\/health|_mapping|_settings|_stats|_notifications\/configs|^_?$/

export default function Console() {
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState(PRESETS[1].path)
  const [body, setBody] = useState('')
  const [out, setOut] = useState('')
  const [status, setStatus] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [ms, setMs] = useState<number | null>(null)
  const [range, setRange] = useState('1h')
  // presets that read sessions follow the chosen time range
  const withRange = (b: string) => {
    const r = resolveRange(range)
    const q = r.all ? '{ "match_all": {} }' : `{ "range": { "firstPacket": { "gte": ${Math.floor(r.from)}, "lte": ${Math.floor(r.to)} } } }`
    return b.replace(/__Q__/g, q)
  }

  const run = async () => {
    if (method !== 'GET' && method !== 'HEAD' && !READ_ONLY.test(path)) {
      if (!window.confirm(`${method} ${path}\n\nThis may change data on the server. Send it?`)) return
    }
    setBusy(true)
    const t0 = performance.now()
    try {
      const r = await osProxy(method, path.replace(/^\//, ''), body.trim() || undefined)
      setStatus(r.status)
      setOut(r.json ? JSON.stringify(r.json, null, 2) : r.text)
    } catch (e: any) {
      setStatus(null)
      setOut(`Request failed: ${e?.message ?? e}`)
    } finally {
      setMs(Math.round(performance.now() - t0))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="row-between">
        <h1>Console</h1>
        <span className="muted small">Sends requests to the search engine through the dashboards backend.</span>
      </div>
      <div className="toolbar">
        <RangeSelect value={range} onChange={setRange} label="Time range for session queries" />
        {PRESETS.map((p) => (
          <button key={p.label} className="btn ghost" onClick={() => { setMethod(p.method); setPath(p.path); setBody(withRange(p.body)); setOut(''); setStatus(null) }}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="toolbar card">
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
          {['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <input style={{ flex: 1, minWidth: 240 }} value={path} onChange={(e) => setPath(e.target.value)} placeholder="path, e.g. _cat/indices?v" aria-label="Path" onKeyDown={(e) => e.key === 'Enter' && run()} />
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
      <textarea style={{ width: '100%', minHeight: 130, fontFamily: 'monospace' }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Request body (JSON), optional" aria-label="Body" />
      <p className="muted small">
        {status !== null ? `Status ${status}` : ''} {ms !== null ? `· ${ms} ms` : ''}
      </p>
      <pre className="card" style={{ maxHeight: 520, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{out || 'The answer will show here.'}</pre>
    </>
  )
}
