import { parseCustom, makeCustom, RANGES } from '../lib/query'

const pad = (n: number) => String(n).padStart(2, '0')
// <input type="datetime-local"> works in local time: "YYYY-MM-DDTHH:mm"
const toInput = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// The same time-range control on every screen: presets plus a "Custom range" with a date and time picker.
export default function RangeSelect({ value, onChange, label = 'Time range', className }: { value: string; onChange: (v: string) => void; label?: string; className?: string }) {
  const custom = parseCustom(value)
  const isCustom = value.startsWith('custom')
  const now = Date.now()
  const from = custom?.from ?? now - 24 * 3600e3
  const to = custom?.to ?? now
  const set = (f: number, t: number) => {
    if (Number.isFinite(f) && Number.isFinite(t) && t > f) onChange(makeCustom(f, t))
  }
  return (
    <span style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        className={className}
        value={isCustom ? 'custom' : value}
        onChange={(e) => (e.target.value === 'custom' ? onChange(makeCustom(now - 24 * 3600e3, now)) : onChange(e.target.value))}
        aria-label={label}
        title={label}
      >
        {RANGES.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
        <option value="custom">Custom range…</option>
      </select>
      {isCustom && (
        <>
          <input type="datetime-local" aria-label="From" title="From" value={toInput(from)} max={toInput(to)} onChange={(e) => set(new Date(e.target.value).getTime(), to)} />
          <span className="muted small">to</span>
          <input type="datetime-local" aria-label="To" title="To" value={toInput(to)} min={toInput(from)} onChange={(e) => set(from, new Date(e.target.value).getTime())} />
        </>
      )}
    </span>
  )
}
