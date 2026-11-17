import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, pick } from '../api'
import { Filters, flatten, mergeFilters, rangeParams } from '../lib/query'

const PAGE = 25
const IP_FIELDS = ['source.ip', 'destination.ip', 'related.ip']

interface Props {
  title: string
  columns: string[]
  range: string
  base: Filters
  refreshKey: number
  onPick: (field: string, value: string, negate?: boolean) => void
}

function show(v: any): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// Documents list with row expansion; clicking a value in the expanded row adds it as a filter
// (the same pivot behaviour as the original Discover/saved-search tables).
export default function EventTable({ title, columns, range, base, refreshKey, onPick }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filter = mergeFilters(base)
  const cols = columns.length ? columns : ['source.ip', 'destination.ip', 'network.protocol', 'event.dataset']

  useEffect(() => setPage(0), [range, filter, refreshKey])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setOpen(null)
    const { from, to } = rangeParams(range)
    const q = { from, to, filter, limit: PAGE, offset: page * PAGE, track_total_hits: 'true' }
    // Newest first. The API filters on firstPacket by default, but some indices only map @timestamp,
    // so try both and finally fall back to the backend's default order.
    getJSON('/mapi/document', { ...q, sort: '-@timestamp' })
      .catch(() => getJSON('/mapi/document', { ...q, sort: '-firstPacket' }))
      .catch(() => getJSON('/mapi/document', q))
      .then((r) => {
        if (!alive) return
        setRows(r.results ?? [])
        const t = r.total
        setTotal(typeof t === 'object' && t ? t.value : (t ?? null))
      })
      .catch((e) => alive && (setError(e.message ?? String(e)), setRows([])))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [range, filter, page, refreshKey])

  const pages = total ? Math.max(1, Math.ceil(total / PAGE)) : 1

  return (
    <div className="card table-wrap" style={{ padding: 0 }}>
      <div className="row-between" style={{ padding: '0.8rem 1rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="muted">{total === null ? '' : `${total.toLocaleString()} hits`}</span>
      </div>
      {error && <p className="err" style={{ padding: '0 1rem' }}>Could not load logs: {error}</p>}
      <table>
        <thead>
          <tr>
            <th>Time</th>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={cols.length + 1} className="muted">
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + 1} className="muted">
                No documents
              </td>
            </tr>
          )}
          {rows.map((r, i) => {
            const src = r._source ?? {}
            const flat = open === i ? flatten(src) : null
            const ts = pick(src, ['@timestamp', 'firstPacket', 'event.ingested'])
            return [
              <tr key={r._id ?? i} className="clickable" onClick={() => setOpen(open === i ? null : i)}>
                <td style={{ whiteSpace: 'nowrap' }}>{ts ? new Date(typeof ts === 'number' ? ts : ts).toLocaleString() : ''}</td>
                {cols.map((c) => (
                  <td key={c}>{show(pick(src, [c]))}</td>
                ))}
              </tr>,
              flat && (
                <tr key={`${r._id ?? i}-d`}>
                  <td colSpan={cols.length + 1} className="detail">
                    <table>
                      <tbody>
                        {Object.entries(flat)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([k, v]) => (
                            <tr key={k}>
                              <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                                {k}
                              </td>
                              <td style={{ wordBreak: 'break-all' }}>{show(v)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {v !== '' && v != null && typeof v !== 'object' && (
                                  <>
                                    <button className="link" title="Filter for value" onClick={() => onPick(k, String(v))}>
                                      +
                                    </button>{' '}
                                    <button className="link" title="Filter out value" onClick={() => onPick(k, String(v), true)}>
                                      −
                                    </button>{' '}
                                    {IP_FIELDS.includes(k) && (
                                      <>
                                        <Link to={`/sessions?expression=${encodeURIComponent(`ip == ${v}`)}`}>Sessions</Link>{' '}
                                        <Link to={`/assets?tab=ips&q=${encodeURIComponent(String(v))}`}>Asset</Link>
                                      </>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
      <div className="toolbar" style={{ justifyContent: 'flex-end', padding: '0 1rem 0.8rem' }}>
        <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Prev
        </button>
        <span className="muted">
          Page {page + 1} / {pages}
        </span>
        <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
