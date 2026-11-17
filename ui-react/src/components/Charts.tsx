import { useState } from 'react'

export const PALETTE = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#a78bfa', '#2dd4bf']

// Donut with a legend. Hover a slice or a legend row to read its value; click to drill down when onSelect is given.
export function Donut({ data, center, sub, onSelect }: { data: { label: string; value: number }[]; center: string; sub: string; onSelect?: (label: string) => void }) {
  const [hi, setHi] = useState<number | null>(null)
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const R = 62
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="ov-donut">
      <svg viewBox="0 0 180 180" role="img" aria-label={sub}>
        <circle cx="90" cy="90" r={R} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.value / total) * C
          const el = (
            <circle
              key={d.label}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={hi === i ? 24 : 20}
              strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 90 90)"
              onMouseEnter={() => setHi(i)}
              onMouseLeave={() => setHi(null)}
              onClick={() => onSelect?.(d.label)}
              style={{ transition: 'stroke-width .15s', cursor: onSelect ? 'pointer' : 'default' }}
            />
          )
          acc += len
          return el
        })}
        <text x="90" y="88" textAnchor="middle" fontSize="22" fontWeight="700" style={{ fill: 'var(--text-strong)' }}>{hi === null ? center : data[hi].value.toLocaleString()}</text>
        <text x="90" y="106" textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted-2)' }}>{hi === null ? sub : data[hi].label.slice(0, 22)}</text>
      </svg>
      <ul>
        {data.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={hi === i ? 'on' : ''} onClick={() => onSelect?.(d.label)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span title={d.label}>{d.label}</span>
            <b>{d.value / total < 0.01 ? '<1' : Math.round((d.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
