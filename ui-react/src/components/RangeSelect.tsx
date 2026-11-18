import { RANGES } from '../lib/query'

// The same time-range dropdown on every screen, so the filter looks and works the same everywhere.
export default function RangeSelect({ value, onChange, label = 'Time range', className }: { value: string; onChange: (v: string) => void; label?: string; className?: string }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} title={label}>
      {RANGES.map((r) => (
        <option key={r.key} value={r.key}>
          {r.label}
        </option>
      ))}
    </select>
  )
}
