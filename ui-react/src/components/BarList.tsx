import { Donut, PALETTE } from './Charts'
import { niceName } from '../lib/relabel'

export interface Bucket {
  key: string | number
  doc_count: number
}

// Top-values panel. A handful of categories shows as a donut, longer lists as ranked bars. Click a value to drill down (onSelect).
export default function BarList({
  title,
  buckets,
  onSelect,
  loading,
  error,
  note,
}: {
  title: string
  buckets: Bucket[]
  onSelect?: (key: string) => void
  loading?: boolean
  error?: boolean
  note?: string
}) {
  const max = Math.max(1, ...buckets.map((b) => b.doc_count))
  const total = buckets.reduce((a, b) => a + b.doc_count, 0) || 1
  const asDonut = !loading && !error && buckets.length >= 2 && buckets.length <= 6
  return (
    <div className="card top-values">
      <h3>{title}</h3>
      {loading && <p className="muted">Loading…</p>}
      {note && !error && <p className="muted small">{note}</p>}
      {error && <p className="err small">Server error for this panel (the field may not be indexed on this server)</p>}
      {!loading && !error && buckets.length === 0 && <p className="muted">No data</p>}
      {asDonut && (
        <Donut
          data={buckets.map((b) => ({ label: niceName(String(b.key)), value: b.doc_count }))}
          center={total >= 1e6 ? `${+(total / 1e6).toFixed(1)}M` : total >= 1000 ? `${+(total / 1000).toFixed(1)}k` : String(total)}
          sub="events"
          onSelect={onSelect}
        />
      )}
      {!asDonut && (
        <ul className="bars ranked">
          {buckets.map((b, i) => (
            <li key={String(b.key)}>
              <button type="button" className="link bar-row" disabled={!onSelect} onClick={() => onSelect?.(String(b.key))}>
                <span className="bar-rank">{i + 1}</span>
                <span className="bar-main">
                  <span className="bar-label" title={String(b.key)}>
                    {niceName(String(b.key))}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${Math.max(2, (b.doc_count / max) * 100)}%`, background: `linear-gradient(90deg, var(--dc, ${PALETTE[0]}), color-mix(in srgb, var(--dc, ${PALETTE[0]}) 45%, #818cf8))` }} />
                  </span>
                </span>
                <span className="bar-count">
                  {b.doc_count.toLocaleString()}
                  <em>{b.doc_count / total < 0.01 ? '<1' : Math.round((b.doc_count / total) * 100)}%</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
