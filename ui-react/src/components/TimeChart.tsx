import { useState } from 'react'

// Smooth gradient area chart for "log count over time" panels, with a hover read-out.
export interface TimePoint {
  t: number // slice start, ms
  count: number
}

export default function TimeChart({ points, height = 170 }: { points: TimePoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const w = 640
  const pad = { l: 46, r: 10, t: 12, b: 24 }
  const max = Math.max(1, ...points.map((p) => p.count))
  const nice = Math.pow(10, Math.floor(Math.log10(max)))
  const top = Math.ceil(max / nice) * nice
  const n = points.length
  const x = (i: number) => pad.l + (n > 1 ? (i * (w - pad.l - pad.r)) / (n - 1) : (w - pad.l - pad.r) / 2)
  const y = (v: number) => pad.t + (1 - v / top) * (height - pad.t - pad.b)
  const long = n > 1 && points[n - 1].t - points[0].t > 36e5 * 30
  const fmt = (t: number) => {
    const d = new Date(t)
    return long ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const label = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v)))
  // smooth path (monotone-ish via midpoints)
  const line = points
    .map((p, i) => {
      if (i === 0) return `M${x(0).toFixed(1)},${y(p.count).toFixed(1)}`
      const px = x(i - 1)
      const mx = (px + x(i)) / 2
      return `C${mx.toFixed(1)},${y(points[i - 1].count).toFixed(1)} ${mx.toFixed(1)},${y(p.count).toFixed(1)} ${x(i).toFixed(1)},${y(p.count).toFixed(1)}`
    })
    .join(' ')
  const area = n ? `${line} L${x(n - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z` : ''
  const gid = `tg${Math.round(top)}${n}`
  const h = hover === null ? null : points[hover]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label="Log count over time" onMouseLeave={() => setHover(null)} className="time-chart">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dc, var(--accent))" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--dc, var(--accent))" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={y(top * f)} y2={y(top * f)} style={{ stroke: 'var(--border-dark)' }} strokeDasharray="3 4" />
          <text x={pad.l - 6} y={y(top * f) + 4} textAnchor="end" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{label(top * f)}</text>
        </g>
      ))}
      {n > 1 && <path d={area} fill={`url(#${gid})`} />}
      {n > 1 && <path d={line} fill="none" style={{ stroke: 'var(--dc, var(--accent))' }} strokeWidth="2.2" strokeLinejoin="round" />}
      {n === 1 && <rect x={x(0) - 20} y={y(points[0].count)} width="40" height={height - pad.b - y(points[0].count)} rx="4" fill={`url(#${gid})`} style={{ stroke: 'var(--dc, var(--accent))' }} />}
      {points.map((p, i) => (
        <rect key={p.t} x={x(i) - (w - pad.l - pad.r) / Math.max(1, n) / 2} y={pad.t} width={(w - pad.l - pad.r) / Math.max(1, n)} height={height - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
      ))}
      {n > 0 && (
        <>
          <text x={pad.l} y={height - 7} fontSize="10" style={{ fill: 'var(--muted-2)' }}>{fmt(points[0].t)}</text>
          {n > 2 && <text x={(pad.l + w - pad.r) / 2} y={height - 7} textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{fmt(points[Math.floor(n / 2)].t)}</text>}
          <text x={w - pad.r} y={height - 7} textAnchor="end" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{fmt(points[n - 1].t)}</text>
        </>
      )}
      {hover !== null && h && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} style={{ stroke: 'var(--dc, var(--accent))' }} strokeOpacity="0.5" />
          <circle cx={x(hover)} cy={y(h.count)} r="4" style={{ fill: 'var(--panel-dark)', stroke: 'var(--dc, var(--accent))' }} strokeWidth="2" />
          <g transform={`translate(${Math.min(Math.max(x(hover) - 66, pad.l), w - 148)},${pad.t})`}>
            <rect width="140" height="40" rx="6" style={{ fill: 'var(--panel-dark)', stroke: 'var(--tip-border)' }} />
            <text x="8" y="16" fontSize="10.5" style={{ fill: 'var(--muted-2)' }}>{new Date(h.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</text>
            <text x="8" y="32" fontSize="13" fontWeight="700" style={{ fill: 'var(--text-strong)' }}>{h.count.toLocaleString()} events</text>
          </g>
        </g>
      )}
    </svg>
  )
}
