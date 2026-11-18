import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatBytes, formatTime, getJSON, pick } from '../api'
import PageHero from '../components/PageHero'
import RangeSelect from '../components/RangeSelect'
import { rangeParams } from '../lib/query'

// Native sessions list on top of the Arkime viewer API:
//   GET /arkime/api/sessions?length=&start=&date=<hours, -1=all>&expression=<arkime expression>
// Arkime renames DB fields between versions, so each column tries several keys.
const PAGE = 50

type Row = Record<string, any>

// Packet view: Arkime renders the packets as an HTML fragment. It goes into a sandboxed frame
// (no scripts, no same-origin access) because payload bytes are attacker-controlled.
function PacketView({ row }: { row: Row }) {
  const [base, setBase] = useState('hex')
  const [packets, setPackets] = useState(50)
  const [open, setOpen] = useState(false)
  const node = row.node
  const id = row.id
  if (!node || !id) return <p className="muted small">This record has no node/id, so packets can't be shown here.</p>
  const src = `/arkime/api/session/${encodeURIComponent(node)}/${encodeURIComponent(id)}/packets?base=${base}&packets=${packets}&line=false&image=false&gzip=false&ts=false&decode=%7B%7D`
  return (
    <div>
      <div className="toolbar">
        {!open && (
          <button className="btn" onClick={() => setOpen(true)}>
            Show packets
          </button>
        )}
        {open && (
          <>
            <label className="muted small">
              Format{' '}
              <select value={base} onChange={(e) => setBase(e.target.value)}>
                <option value="hex">Hex</option>
                <option value="ascii">ASCII</option>
                <option value="utf8">UTF-8</option>
              </select>
            </label>
            <label className="muted small">
              Packets{' '}
              <select value={packets} onChange={(e) => setPackets(Number(e.target.value))}>
                {[10, 50, 200, 1000].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <a className="link-out" href={`/packetvault/api/session/${encodeURIComponent(node)}/${encodeURIComponent(id)}/pcap`}>
          Download PCAP ↓
        </a>
      </div>
      {open && <iframe title="Session packets" sandbox="" src={src} style={{ width: '100%', height: 360, border: '1px solid var(--border)', background: '#fff' }} />}
    </div>
  )
}

export default function Sessions() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [range, setRange] = useState('1h')
  const [params] = useSearchParams()
  const initial = params.get('expression') ?? ''
  const [expression, setExpression] = useState(initial)
  const [applied, setApplied] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getJSON('/arkime/api/sessions', {
        length: PAGE,
        start: page * PAGE,
        ...(range === 'all' ? { date: -1 } : { startTime: rangeParams(range).from, stopTime: rangeParams(range).to }),
        expression: applied || undefined,
        order: 'firstPacket:desc',
      })
      setRows(r.data ?? [])
      setTotal(r.recordsFiltered ?? r.recordsTotal ?? 0)
    } catch (e: any) {
      setError(e.message ?? String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, range, applied])

  useEffect(() => {
    load()
  }, [load])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setApplied(expression.trim())
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <>
      <PageHero icon="📡" title="Sessions" sub="Search captured network sessions and open the packets behind them." href="/packetvault/" linkLabel="Open full PacketVault ↗" />

      <form className="toolbar card" onSubmit={submit}>
        <input
          style={{ flex: 1, minWidth: 240 }}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder='Search expression, e.g. ip.src == 10.0.0.5 && port.dst == 443'
          aria-label="Search expression"
        />
        <RangeSelect
          value={range}
          onChange={(v) => {
            setPage(0)
            setRange(v)
          }}
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      {error && <p className="err">Could not load sessions: {error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Start</th>
              <th>Protocol</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Packets</th>
              <th>Bytes</th>
              <th>Node</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No sessions
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className="clickable" onClick={() => setSelected(r)}>
                <td>{formatTime(pick(r, ['firstPacket', 'firstPacket_ms']))}</td>
                <td>{pick(r, ['ipProtocol', 'ip.protocol', 'protocol']) ?? ''}</td>
                <td>
                  {pick(r, ['source.ip', 'srcIp', 'ip.src']) ?? ''}:{pick(r, ['source.port', 'srcPort', 'port.src']) ?? ''}
                </td>
                <td>
                  {pick(r, ['destination.ip', 'dstIp', 'ip.dst']) ?? ''}:{pick(r, ['destination.port', 'dstPort', 'port.dst']) ?? ''}
                </td>
                <td>{(pick(r, ['network.packets', 'totPackets']) ?? '').toLocaleString?.() ?? ''}</td>
                <td>{formatBytes(Number(pick(r, ['network.bytes', 'totBytes', 'dbby']) ?? 0))}</td>
                <td>{r.node ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="toolbar" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
        <span className="muted">{total.toLocaleString()} sessions</span>
        <span>
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Prev
          </button>{' '}
          <span className="muted">
            Page {page + 1} / {pages}
          </span>{' '}
          <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </span>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="card modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Session details</h3>
            <PacketView row={selected} />
            <details>
              <summary className="muted small">Raw session record</summary>
              <pre>{JSON.stringify(selected, null, 2)}</pre>
            </details>
            <div className="toolbar">
              {selected.id && (
                <a
                  className="btn"
                  href={`/packetvault/sessions?expression=${encodeURIComponent(`id == ${selected.id}`)}`}
                >
                  Packets in PacketVault ↗
                </a>
              )}
              <button className="btn" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
