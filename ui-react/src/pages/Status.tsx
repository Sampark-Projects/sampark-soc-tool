import { labelOf } from '../data/components'
import { useCallback, useEffect, useState } from 'react'
import { getJSON } from '../api'
import RangeSelect from '../components/RangeSelect'
import { niceName } from '../lib/relabel'
import { inRange } from '../lib/query'
import PageHero from '../components/PageHero'

// System status: /mapi/ready, /mapi/version, /mapi/ingest-stats, /mapi/indices
interface Res<T> {
  data?: T
  error?: string
}

const settle = async <T,>(p: Promise<T>): Promise<Res<T>> => {
  try {
    return { data: await p }
  } catch (e: any) {
    return { error: e.message ?? String(e) }
  }
}

function age(seconds?: number) {
  if (seconds == null) return '—'
  if (seconds < 90) return `${Math.round(seconds)} s`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`
  return `${(seconds / 86400).toFixed(1)} days`
}

export default function Status() {
  const [ready, setReady] = useState<Res<Record<string, boolean>>>({})
  const [version, setVersion] = useState<Res<any>>({})
  const [ingest, setIngest] = useState<Res<{ sources: Record<string, string>; latest_ingest_age_seconds?: number }>>({})
  const [indices, setIndices] = useState<Res<{ indices: any[] }>>({})
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('1h')

  const load = useCallback(async () => {
    setLoading(true)
    const [r, v, i, x] = await Promise.all([
      settle(getJSON('/mapi/ready')),
      settle(getJSON('/mapi/version')),
      settle(getJSON('/mapi/ingest-stats')),
      settle(getJSON('/mapi/indices')),
    ])
    setReady(r)
    setVersion(v)
    setIngest(i)
    setIndices(x)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const health = version.data?.opensearch?.health
  const essential = ['opensearch', 'pcap_monitor', 'logstash_lumberjack', 'logstash_pipelines']

  const svc = Object.entries(ready.data ?? {})
  const up = svc.filter(([, v]) => v).length
  const down = svc.filter(([k, v]) => !v && essential.includes(k)).length
  const docs = (indices.data?.indices ?? []).reduce((a, r) => a + (Number(r['docs.count']) || 0), 0)
  const hs = String(health?.status ?? '')
  const hsColor = hs === 'green' ? '#34d399' : hs === 'yellow' ? '#fbbf24' : hs ? '#f87171' : '#94a3b8'
  const sources = Object.entries(ingest.data?.sources ?? {}).filter(([, v]) => inRange(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v + 'Z', range))

  return (
    <>
      <PageHero icon="🩺" title="System Status" sub="Which services are running, how the search cluster is doing and when data last arrived.">
        <RangeSelect value={range} onChange={setRange} label="Show sensors and indices active within" />
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </PageHero>

      <div className="ov-kpis">
        <div className="ov-kpi" style={{ ['--c' as any]: down ? '#f87171' : '#34d399' }}>
          <span className="ov-kpi-label">Services</span>
          <span className="ov-kpi-value">{svc.length ? `${up}/${svc.length}` : '…'}</span>
          <span className="ov-kpi-hint">{down ? `${down} required service${down > 1 ? 's' : ''} down` : 'all required services up'}</span>
        </div>
        <div className="ov-kpi" style={{ ['--c' as any]: hsColor }}>
          <span className="ov-kpi-label">Search cluster</span>
          <span className="ov-kpi-value" style={{ textTransform: 'capitalize' }}>{hs || '…'}</span>
          <span className="ov-kpi-hint">{health ? `${health.number_of_nodes} node, ${health.unassigned_shards} unassigned shards` : ''}</span>
        </div>
        <div className="ov-kpi" style={{ ['--c' as any]: '#38bdf8' }}>
          <span className="ov-kpi-label">Latest ingest</span>
          <span className="ov-kpi-value">{ingest.data ? age(ingest.data.latest_ingest_age_seconds) : '…'}</span>
          <span className="ov-kpi-hint">ago</span>
        </div>
        <div className="ov-kpi" style={{ ['--c' as any]: '#818cf8' }}>
          <span className="ov-kpi-label">Documents</span>
          <span className="ov-kpi-value">{indices.data ? docs.toLocaleString() : '…'}</span>
          <span className="ov-kpi-hint">{indices.data ? `${indices.data.indices.length} indices` : ''}</span>
        </div>
      </div>

      <h2>Services</h2>
      {ready.error && <p className="err small">Could not load: {ready.error}</p>}
      <div className="svc-grid">
        {svc.map(([k, v]) => (
          <div key={k} className={`svc ${v ? 'up' : 'down'}`}>
            <i />
            <span>{labelOf(k) ?? niceName(k)}</span>
            {essential.includes(k) && <em>required</em>}
            <b>{v ? 'running' : 'down'}</b>
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="card">
          <h3>Version</h3>
          {version.error && <p className="err small">Could not load: {version.error}</p>}
          {version.data && (
            <dl className="kv">
              <dt>{labelOf('Malcolm')}</dt><dd>{version.data.version}</dd>
              <dt>Mode</dt><dd>{niceName(String(version.data.mode ?? ""))}</dd>
              <dt>Built</dt><dd>{version.data.built}</dd>
              <dt>Started</dt><dd>{version.data.boot_time}</dd>
              <dt>Machine</dt><dd>{version.data.machine}</dd>
              <dt>{labelOf('OpenSearch')}</dt><dd>{version.data.opensearch?.version?.number}</dd>
            </dl>
          )}
        </section>
        <section className="card">
          <h3>Ingest by sensor</h3>
          {ingest.error && <p className="err small">Could not load: {ingest.error}</p>}
          {sources.length === 0 && ingest.data && <p className="muted small">No sensors have reported yet.</p>}
          <dl className="kv">
            {sources.map(([k, v]) => (
              <span key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v + 'Z').toLocaleString()}</dd>
              </span>
            ))}
          </dl>
        </section>
      </div>

      <h2>Indices</h2>
      {indices.error && <p className="err small">Could not load: {indices.error}</p>}
      {indices.data && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Index</th>
                <th>Health</th>
                <th>Status</th>
                <th>Documents</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {[...indices.data.indices]
                .filter((i) => !Number(i['creation.date']) || inRange(Number(i['creation.date']), range))
                .sort((a, b) => String(b.index).localeCompare(String(a.index)))
                .map((i) => (
                  <tr key={i.uuid ?? i.index}>
                    <td>{niceName(String(i.index))}</td>
                    <td><span className={`dot ${i.health}`} /> {i.health}</td>
                    <td>{i.status}</td>
                    <td>{Number(i['docs.count']).toLocaleString()}</td>
                    <td>{i['store.size']}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
