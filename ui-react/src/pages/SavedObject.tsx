import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { savedObject } from '../api'
import { catalog } from '../data/catalog'
import PageHero from '../components/PageHero'
import { niceName, realId } from '../lib/relabel'

// Local detail view of a saved object (dashboard, visualization, saved search, index pattern).
const parse = (s: unknown): any => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s
  } catch {
    return null
  }
}

async function titlesOf(refs: { type: string; id: string }[]): Promise<Record<string, string>> {
  if (!refs.length) return {}
  const res = await fetch('/dashboards/api/saved_objects/_bulk_get', {
    method: 'POST',
    headers: { 'osd-xsrf': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify(refs.map((r) => ({ type: r.type, id: r.id }))),
  })
  if (!res.ok) return {}
  const j = await res.json()
  const out: Record<string, string> = {}
  for (const o of j.saved_objects ?? []) out[`${o.type}:${o.id}`] = o.attributes?.title ?? o.id
  return out
}

export default function SavedObject() {
  const { type = '', id: shown = '' } = useParams()
  const id = realId(shown)
  const [obj, setObj] = useState<any>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setObj(null)
    setError(null)
    savedObject(type, id)
      .then(async (o) => {
        if (!alive) return
        setObj(o)
        const n = await titlesOf((o.references ?? []).slice(0, 100)).catch(() => ({}))
        if (alive) setNames(n)
      })
      .catch((e) => alive && setError(e.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [type, id])

  const a = obj?.attributes ?? {}
  const refs: { name: string; type: string; id: string }[] = obj?.references ?? []
  const local = useMemo(() => (type === 'dashboard' ? catalog.dashboards.find((d) => d.id === id) : undefined), [type, id])

  const panels = useMemo(() => (type === 'dashboard' ? (parse(a.panelsJSON) ?? []) : []), [type, a.panelsJSON])
  const vis = useMemo(() => (type === 'visualization' ? parse(a.visState) : null), [type, a.visState])
  const source = useMemo(() => parse(a.kibanaSavedObjectMeta?.searchSourceJSON), [a.kibanaSavedObjectMeta])
  const queryText: string = source?.query?.query?.query_string?.query ?? (typeof source?.query?.query === 'string' ? source.query.query : '')
  const fields = useMemo(() => (type === 'index-pattern' ? (parse(a.fields) ?? []) : []), [type, a.fields])

  const panelTitle = (p: any) => {
    const t = p.embeddableConfig?.title
    if (t) return t
    const ref = refs.find((r) => r.name === p.panelRefName)
    return ref ? names[`${ref.type}:${ref.id}`] ?? ref.id : p.panelIndex
  }

  return (
    <>
      <PageHero icon="📦" title={niceName(String(a.title ?? id))} sub={`Saved ${type}`} to="/management" linkLabel="← Back to Management" />
      {error && <p className="err">Could not load this object: {error}</p>}
      {!obj && !error && <p className="muted">Loading…</p>}
      {obj && (
        <>
          <p className="muted small">
            {type} · {obj.updated_at ? `updated ${new Date(obj.updated_at).toLocaleString()}` : ''} · id {niceName(id)}
          </p>
          {a.description && <p>{a.description}</p>}

          {type === 'dashboard' && (
            <div className="card">
              <p><Link to={local ? `/dashboards/${local.slug}` : `/dashboards/saved/${encodeURIComponent(id)}`}>Open this dashboard</Link></p>
              <h3>Panels ({panels.length})</h3>
              <ul>
                {panels.map((p: any, i: number) => <li key={i}>{niceName(String(panelTitle(p)))}</li>)}
              </ul>
            </div>
          )}

          {type === 'visualization' && vis && (
            <div className="card">
              <h3>{vis.type}</h3>
              <table>
                <thead><tr><th>Aggregation</th><th>Schema</th><th>Field</th></tr></thead>
                <tbody>
                  {(vis.aggs ?? []).map((g: any, i: number) => (
                    <tr key={i}><td>{g.type}</td><td>{g.schema}</td><td>{g.params?.field ?? ''}</td></tr>
                  ))}
                </tbody>
              </table>
              {queryText && <p className="muted small">Query: <code>{queryText}</code></p>}
            </div>
          )}

          {type === 'search' && (
            <div className="card">
              <h3>Saved search</h3>
              <p>Query: <code>{queryText || '(none)'}</code></p>
              <p>Columns: {niceName((a.columns ?? []).join(', ')) || '(default)'}</p>
              <p>Sorted by: {(a.sort ?? []).map((s: any) => s.join(' ')).join(', ') || '(default)'}</p>
              <p><Link to={`/explorer?cols=${encodeURIComponent((a.columns ?? []).join(','))}`}>Explore these events</Link></p>
            </div>
          )}

          {type === 'index-pattern' && (
            <div className="card table-wrap">
              <h3>{fields.length.toLocaleString()} fields{a.timeFieldName ? ` · time field ${a.timeFieldName}` : ''}</h3>
              <table>
                <thead><tr><th>Name</th><th>Type</th><th>Searchable</th><th>Aggregatable</th></tr></thead>
                <tbody>
                  {fields.slice(0, 300).map((f: any) => (
                    <tr key={f.name}><td>{f.name}</td><td>{f.type}</td><td>{String(f.searchable)}</td><td>{String(f.aggregatable)}</td></tr>
                  ))}
                </tbody>
              </table>
              {fields.length > 300 && <p className="muted small">Showing the first 300 fields.</p>}
            </div>
          )}

          {refs.length > 0 && type !== 'dashboard' && (
            <div className="card">
              <h3>References</h3>
              <ul>
                {refs.map((r, i) => (
                  <li key={i}>
                    <Link to={`/management/${r.type}/${encodeURIComponent(niceName(r.id))}`}>{niceName(String(names[`${r.type}:${r.id}`] ?? r.id))}</Link> <span className="muted small">({r.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="card">
            <summary>Raw definition</summary>
            <pre style={{ maxHeight: 420, overflow: 'auto' }}>{JSON.stringify(obj, null, 2)}</pre>
          </details>
        </>
      )}
    </>
  )
}
