import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getJSON } from '../api'
import BarList, { Bucket } from '../components/BarList'
import EventTable from '../components/EventTable'
import { describeFilter, Filters, rangeParams } from '../lib/query'
import RangeSelect from '../components/RangeSelect'
import PageHero from '../components/PageHero'

// Free-form event explorer (the Discover equivalent) on /mapi/fields, /mapi/agg and /mapi/document.
// The API filters by exact field values (AND across fields, lists = OR, "!" = NOT); there is no
// free-text/Lucene query, so searching is by field + value.
const DEFAULT_COLUMNS = ['event.provider', 'event.dataset', 'source.ip', 'destination.ip', 'network.protocol']

export default function Explorer() {
  const [range, setRange] = useState('7d')
  const [filters, setFilters] = useState<Filters>({})
  const [params] = useSearchParams()
  const [columns, setColumns] = useState<string[]>(() => {
    const c = (params.get('cols') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    return c.length ? c : DEFAULT_COLUMNS
  })
  const [refreshKey, setRefreshKey] = useState(0)

  const [fields, setFields] = useState<Record<string, { type?: string; description?: string }>>({})
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [fieldQuery, setFieldQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [top, setTop] = useState<Bucket[] | null>(null)

  const [ff, setFf] = useState('')
  const [fv, setFv] = useState('')
  const [neg, setNeg] = useState(false)

  useEffect(() => {
    getJSON('/mapi/fields')
      .then((r) => setFields(r.fields ?? {}))
      .catch((e) => setFieldError(e.message ?? String(e)))
  }, [])

  const names = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase()
    return Object.keys(fields)
      .filter((n) => !n.endsWith('.text') && (!q || n.toLowerCase().includes(q)))
      .sort()
      .slice(0, 300)
  }, [fields, fieldQuery])

  // The long field list is split by the first part of the name (source, destination, zeek, ...); a group opens when clicked.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const toggleGroup = useCallback((g: string) => setOpenGroups((o) => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n }), [])
  const fieldGroups = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const n of names) {
      const g = n.includes('.') ? n.slice(0, n.indexOf('.')) : 'general'
      m.set(g, [...(m.get(g) ?? []), n])
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [names])

  // Top values of the selected field under the current filters.
  useEffect(() => {
    if (!active) return
    let alive = true
    setTop(null)
    const { from, to } = rangeParams(range)
    getJSON(`/mapi/agg/${encodeURIComponent(active)}`, {
      from,
      to,
      limit: 10,
      filter: Object.keys(filters).length ? JSON.stringify(filters) : undefined,
    })
      .then((r) => alive && setTop(r?.[active]?.buckets ?? []))
      .catch(() => alive && setTop([]))
    return () => {
      alive = false
    }
  }, [active, range, filters, refreshKey])

  const add = useCallback((field: string, value: string, negate = false) => {
    setFilters((f) => {
      const { [negate ? field : `!${field}`]: _o, ...rest } = f
      return { ...rest, [negate ? `!${field}` : field]: value }
    })
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ff.trim() || !fv.trim()) return
    add(ff.trim(), fv.trim(), neg)
    setFv('')
  }

  const toggleColumn = (f: string) => setColumns((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]))

  return (
    <>
      <PageHero icon="🔎" title="Explorer" sub="Browse raw events: pick fields, add filters and inspect each record.">
        <RangeSelect value={range} onChange={setRange} />
        <button className="btn" onClick={() => setRefreshKey((k) => k + 1)}>
          Refresh
        </button>
      </PageHero>

      <form className="toolbar card" onSubmit={submit}>
        <input value={ff} onChange={(e) => setFf(e.target.value)} placeholder="field, e.g. network.protocol" list="field-names" aria-label="Field" style={{ flex: 1, minWidth: 180 }} />
        <input value={fv} onChange={(e) => setFv(e.target.value)} placeholder="value, e.g. dns" aria-label="Value" style={{ flex: 1, minWidth: 140 }} />
        <label className="muted small">
          <input type="checkbox" checked={neg} onChange={(e) => setNeg(e.target.checked)} /> NOT
        </label>
        <button className="btn" type="submit">
          Add filter
        </button>
        <datalist id="field-names">
          {names.slice(0, 100).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </form>

      {Object.keys(filters).length > 0 && (
        <div className="chips">
          {Object.entries(filters).map(([k, v]) => (
            <span className="tag" key={k}>
              {describeFilter(k, v)}
              <button type="button" aria-label={`Remove filter ${k}`} onClick={() => setFilters(({ [k]: _d, ...rest }) => rest)}>
                ×
              </button>
            </span>
          ))}
          <button className="link" onClick={() => setFilters({})}>
            Clear all
          </button>
        </div>
      )}

      <div className="explorer">
        <aside className="card">
          <h3>Fields</h3>
          <input value={fieldQuery} onChange={(e) => setFieldQuery(e.target.value)} placeholder="Filter fields" aria-label="Filter fields" style={{ width: '100%' }} />
          {fieldError && <p className="err small">Could not load fields: {fieldError}</p>}
          {columns.length > 0 && <p className="muted small">Selected: {columns.length}</p>}
          {fieldGroups.map(([group, list]) => {
            const open = !!fieldQuery.trim() || openGroups.has(group) || list.includes(active ?? '') || list.some((n) => columns.includes(n))
            return (
              <div className="nav-group lvl1" key={group}>
                <button type="button" className="nav-toggle" aria-expanded={open} onClick={() => toggleGroup(group)}>
                  <span className="nav-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                  <span className="nav-label">{group}</span>
                  <span className="nav-count">{list.length}</span>
                </button>
                {open && (
                  <ul className="field-list">
                    {list.map((n) => (
                      <li key={n} className={n === active ? 'active' : ''}>
                        <button className="link" onClick={() => setActive(n === active ? null : n)} title={fields[n]?.description ?? ''}>
                          {n}
                        </button>
                        <button className="link" onClick={() => toggleColumn(n)} title={columns.includes(n) ? 'Remove column' : 'Add column'}>
                          {columns.includes(n) ? '✓' : '+'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </aside>

        <div>
          {active && (
            <div style={{ marginBottom: '1rem' }}>
              <BarList title={`Top values: ${active}`} buckets={top ?? []} loading={top === null} onSelect={(v) => add(active, v)} />
            </div>
          )}
          <EventTable title="Events" columns={columns} range={range} base={filters} refreshKey={refreshKey} onPick={add} />
        </div>
      </div>
    </>
  )
}
