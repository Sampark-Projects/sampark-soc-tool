import { useEffect, useState } from 'react'
import { getJSON } from '../api'
import BarList, { Bucket } from '../components/BarList'
import { describeFilter, Filters, RANGES, rangeParams } from '../lib/query'
import PageHero from '../components/PageHero'

// SPI View: top values for many fields at once under shared filters (Arkime SPIView equivalent),
// built on GET /mapi/agg/<field>.
const GROUPS: Record<string, string[]> = {
  General: ['event.provider', 'event.dataset', 'network.protocol', 'network.transport', 'network.direction'],
  Source: ['source.ip', 'source.port', 'source.mac', 'source.oui', 'source.segment.name', 'source.geo.country_name'],
  Destination: ['destination.ip', 'destination.port', 'destination.mac', 'destination.oui', 'destination.segment.name', 'destination.geo.country_name'],
  Tags: ['tags', 'rule.name', 'rule.category', 'file.mime_type'],
}

interface State { b: Bucket[] | null; err?: string }

export default function Spiview() {
  const [range, setRange] = useState('all')
  const [filters, setFilters] = useState<Filters>({})
  const [group, setGroup] = useState('General')
  const [data, setData] = useState<Record<string, State>>({})

  useEffect(() => {
    let alive = true
    const { from, to } = rangeParams(range)
    const fl = Object.keys(filters).length ? JSON.stringify(filters) : undefined
    setData(Object.fromEntries(GROUPS[group].map((f) => [f, { b: null }])))
    GROUPS[group].forEach((f) =>
      getJSON(`/mapi/agg/${encodeURIComponent(f)}`, { from, to, limit: 10, filter: fl })
        .then((r) => alive && setData((d) => ({ ...d, [f]: { b: r?.[f]?.buckets ?? [] } })))
        .catch((e) => alive && setData((d) => ({ ...d, [f]: { b: [], err: e.message ?? String(e) } }))),
    )
    return () => {
      alive = false
    }
  }, [group, range, filters])

  const pick = (field: string, value: string) => setFilters((f) => ({ ...f, [field]: value }))

  return (
    <>
      <PageHero icon="🧭" title="SPI View" sub="Break traffic down by protocol, port, country and more — click any value to filter." href="/arkime/spiview" linkLabel="Open PCAP & Indexing SPI View ↗" />
      <div className="toolbar card">
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Time range">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="tabs">
          {Object.keys(GROUPS).map((g) => (
            <button key={g} className={g === group ? 'active' : ''} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      </div>
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
      <div className="tile-grid">
        {GROUPS[group].map((f) => (
          <BarList key={f} title={f} buckets={data[f]?.b ?? []} loading={data[f]?.b === null} error={!!data[f]?.err} onSelect={(v) => pick(f, v)} />
        ))}
      </div>
    </>
  )
}
