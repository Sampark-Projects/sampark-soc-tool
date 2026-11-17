import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { osProxy } from '../api'
import PageHero from '../components/PageHero'

// Detail view of one alerting monitor, anomaly detector or notification channel.
const PATH: Record<string, (id: string) => string> = {
  monitors: (id) => `_plugins/_alerting/monitors/${encodeURIComponent(id)}`,
  detectors: (id) => `_plugins/_anomaly_detection/detectors/${encodeURIComponent(id)}`,
  channels: (id) => `_plugins/_notifications/configs/${encodeURIComponent(id)}`,
}
const TITLE: Record<string, string> = { monitors: 'Alerting monitor', detectors: 'Anomaly detector', channels: 'Notification channel' }

const fmt = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
const time = (v: unknown) => (Number(v) > 1e9 ? new Date(Number(v) < 1e12 ? Number(v) * 1000 : Number(v)).toLocaleString() : fmt(v))

function summary(kind: string, j: any): [string, string][] {
  if (kind === 'monitors') {
    const m = j?.monitor ?? {}
    const rows: [string, string][] = [
      ['Name', fmt(m.name)],
      ['Type', fmt(m.monitor_type)],
      ['State', m.enabled ? 'enabled' : 'disabled'],
      ['Schedule', m.schedule?.period ? `every ${m.schedule.period.interval} ${String(m.schedule.period.unit ?? '').toLowerCase()}` : fmt(m.schedule)],
      ['Updated', time(m.last_update_time)],
    ]
    for (const [i, inp] of (m.inputs ?? []).entries()) {
      const s = inp.search
      if (s) rows.push([`Input ${i + 1} indices`, (s.indices ?? []).join(', ')], [`Input ${i + 1} query`, JSON.stringify(s.query)])
    }
    for (const [i, t] of (m.triggers ?? []).entries()) {
      const q = t.query_level_trigger ?? t.bucket_level_trigger ?? t.document_level_trigger ?? t
      rows.push([`Trigger ${i + 1}`, `${fmt(q.name)} · severity ${fmt(q.severity)}`], [`Trigger ${i + 1} condition`, fmt(q.condition?.script?.source ?? q.condition)], [`Trigger ${i + 1} actions`, (q.actions ?? []).map((a: any) => a.name).join(', ') || 'none'])
    }
    return rows
  }
  if (kind === 'detectors') {
    const d = j?.anomaly_detector ?? j ?? {}
    return [
      ['Name', fmt(d.name)],
      ['Description', fmt(d.description)],
      ['Indices', (d.indices ?? []).join(', ')],
      ['Time field', fmt(d.time_field)],
      ['Interval', d.detection_interval?.period ? `${d.detection_interval.period.interval} ${String(d.detection_interval.period.unit ?? '').toLowerCase()}` : '—'],
      ['Features', (d.feature_attributes ?? []).map((f: any) => f.feature_name).join(', ') || '—'],
      ['Category fields', (d.category_field ?? []).join(', ') || '—'],
      ['Updated', time(d.last_update_time)],
    ]
  }
  const c = j?.config_list?.[0]?.config ?? {}
  return [
    ['Name', fmt(c.name)],
    ['Type', fmt(c.config_type)],
    ['Description', fmt(c.description)],
    ['State', c.is_enabled ? 'enabled' : 'disabled'],
    ['Features', (c.feature_list ?? []).join(', ') || '—'],
  ]
}

export default function PluginObject() {
  const { kind = '', id = '' } = useParams()
  const [json, setJson] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setJson(null)
    setError(null)
    const path = PATH[kind]?.(id)
    if (!path) {
      setError('Unknown kind')
      return
    }
    osProxy('GET', path)
      .then((r) => {
        if (!alive) return
        if (r.json?.error) setError(typeof r.json.error === 'string' ? r.json.error : r.json.error.reason ?? 'The server could not answer this request.')
        else setJson(r.json)
      })
      .catch((e) => alive && setError(e.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [kind, id])
  return (
    <>
      <PageHero icon="🔔" title={TITLE[kind] ?? kind} sub="Read-only details from the alerting and anomaly-detection plugins" to="/management" linkLabel="← Back to Management" />
      {error && <p className="err">Could not load this item: {error}</p>}
      {!json && !error && <p className="muted">Loading…</p>}
      {json && (
        <>
          <div className="card table-wrap">
            <table>
              <tbody>
                {summary(kind, json).map(([k, v]) => (
                  <tr key={k}><td className="muted">{k}</td><td style={{ wordBreak: 'break-word' }}>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="card">
            <summary>Raw definition</summary>
            <pre style={{ maxHeight: 420, overflow: 'auto' }}>{JSON.stringify(json, null, 2)}</pre>
          </details>
        </>
      )}
    </>
  )
}
