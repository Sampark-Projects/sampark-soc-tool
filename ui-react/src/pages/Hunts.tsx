import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, pick, sendJSON } from '../api'
import PageHero from '../components/PageHero'
import RangeSelect from '../components/RangeSelect'
import { inRange, rangeParams } from '../lib/query'

// Arkime packet-search hunts: list (GET /arkime/api/hunts), create (POST /arkime/api/hunt),
// pause/resume (PUT /arkime/api/hunt/<id>/pause|play) and delete (DELETE /arkime/api/hunt/<id>).

const SEARCH_TYPES = [
  { v: 'ascii', t: 'ASCII (case sensitive)' },
  { v: 'asciicase', t: 'ASCII (case insensitive)' },
  { v: 'hex', t: 'Hex' },
  { v: 'wildcard', t: 'Wildcard' },
  { v: 'regex', t: 'Regex' },
  { v: 'hexregex', t: 'Hex regex' },
]

function NewHunt({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('ascii')
  const [type, setType] = useState('raw')
  const [src, setSrc] = useState(true)
  const [dst, setDst] = useState(true)
  const [size, setSize] = useState(50)
  const [huntRange, setHuntRange] = useState('7d')
  const [expression, setExpression] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const win = rangeParams(huntRange)
      const startTime = Number(win.from)
      const stopTime = Number(win.to)
      // Arkime wants the number of sessions the hunt will cover, so count them first.
      const counted = await getJSON('/arkime/api/sessions', { length: 1, start: 0, startTime, stopTime, expression: expression.trim() || undefined })
      const totalSessions = Number(counted?.recordsFiltered ?? 0)
      if (!totalSessions) throw new Error('No sessions match that time range and expression, so there is nothing to hunt through.')
      await sendJSON('POST', '/arkime/api/hunt', {
        name: name.trim(),
        search: search,
        searchType,
        type,
        src,
        dst,
        size,
        totalSessions,
        query: { startTime, stopTime, expression: expression.trim() },
      })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>New hunt</h3>
        <div className="form-grid">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </label>
          <label>
            Search for
            <input value={search} onChange={(e) => setSearch(e.target.value)} required placeholder="text, hex bytes, wildcard or regex" />
          </label>
          <label>
            Match type
            <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
              {SEARCH_TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search in
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="raw">Raw packets</option>
              <option value="reassembled">Reassembled data</option>
            </select>
          </label>
          <label>
            Time range
            <RangeSelect value={huntRange} onChange={setHuntRange} />
          </label>
          <label>
            Packets per session
            <input type="number" min={1} max={10000} value={size} onChange={(e) => setSize(Number(e.target.value) || 1)} />
          </label>
        </div>
        <label>
          Only sessions matching (PacketVault expression, optional)
          <input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="ip.dst == 8.8.8.8 && port.dst == 53" />
        </label>
        <p>
          <label>
            <input type="checkbox" checked={src} onChange={(e) => setSrc(e.target.checked)} /> Source packets
          </label>{' '}
          <label>
            <input type="checkbox" checked={dst} onChange={(e) => setDst(e.target.checked)} /> Destination packets
          </label>
        </p>
        {error && (
          <p className="err">
            {error}{' '}
            <a href="/packetvault/hunt" className="link-out">
              Create it in PacketVault instead ↗
            </a>
          </p>
        )}
        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy || !name.trim() || !search || (!src && !dst)}>
            {busy ? 'Creating…' : 'Create hunt'}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Hunts() {
  const [all, setRows] = useState<any[]>([])
  const [listRange, setListRange] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const rows = all.filter((h) => inRange(Number(pick(h, ['created'])), listRange))

  const load = useCallback(() => {
    setLoading(true)
    getJSON('/arkime/api/hunts', { length: 100, start: 0, sortField: 'created', desc: 'true' })
      .then((r) => {
        setRows(r?.data ?? [])
        setError(null)
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const act = async (method: 'PUT' | 'DELETE', id: string, suffix = '') => {
    setActionError(null)
    try {
      await sendJSON(method, `/arkime/api/hunt/${encodeURIComponent(id)}${suffix}`)
      load()
    } catch (e: any) {
      setActionError(e.message ?? String(e))
    }
  }

  return (
    <>
      <PageHero icon="🎯" title="Hunts" sub="Search stored packets for strings or patterns across many sessions, and follow their progress." href="/packetvault/hunt" linkLabel="Open in PacketVault ↗">
        <button className="btn" onClick={() => setCreating(true)}>
          New hunt
        </button>
        <button className="btn ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </PageHero>
      {error && <p className="err">Could not load hunts: {error}</p>}
      {actionError && (
        <p className="err">
          {actionError}{' '}
          <a href="/packetvault/hunt" className="link-out">
            Do it in PacketVault ↗
          </a>
        </p>
      )}
      <div className="toolbar">
        <RangeSelect value={listRange} onChange={setListRange} label="Hunts created within" />
        <span className="muted small">{rows.length} of {all.length} hunts</span>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Search</th>
              <th>Matched</th>
              <th>Searched</th>
              <th>Created</th>
              <th>Sessions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {loading ? 'Loading…' : 'No hunts'}
                </td>
              </tr>
            )}
            {rows.map((h, i) => {
              const id = String(pick(h, ['id']) ?? '')
              const status = String(pick(h, ['status']) ?? '—')
              const expr = String(pick(h, ['query.expression']) ?? '')
              const total = Number(pick(h, ['totalSessions'])) || 0
              const searched = Number(pick(h, ['searchedSessions'])) || 0
              const pct = total ? Math.min(100, Math.round((searched / total) * 100)) : 0
              const created = Number(pick(h, ['created']))
              return (
                <tr key={id + i}>
                  <td>{String(pick(h, ['name']) ?? '—')}</td>
                  <td>{status}</td>
                  <td>
                    <code>{String(pick(h, ['search']) ?? '')}</code>
                    <span className="muted small"> ({String(pick(h, ['searchType']) ?? '')})</span>
                  </td>
                  <td>{Number(pick(h, ['matchedSessions']) ?? 0).toLocaleString()}</td>
                  <td>
                    {searched.toLocaleString()} / {total.toLocaleString()} ({pct}%)
                  </td>
                  <td>{Number.isFinite(created) && created > 0 ? new Date(created).toLocaleString() : '—'}</td>
                  <td>{expr ? <Link to={`/sessions?expression=${encodeURIComponent(expr)}`}>Open</Link> : '—'}</td>
                  <td>
                    {id && (status === 'running' || status === 'queued') && (
                      <button className="link" onClick={() => act('PUT', id, '/pause')}>
                        Pause
                      </button>
                    )}
                    {id && status === 'paused' && (
                      <button className="link" onClick={() => act('PUT', id, '/play')}>
                        Resume
                      </button>
                    )}{' '}
                    {id && (
                      <button
                        className="link"
                        onClick={() => {
                          if (window.confirm(`Delete hunt "${String(pick(h, ['name']) ?? id)}"? This cannot be undone.`)) act('DELETE', id)
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {creating && <NewHunt onCreated={load} onClose={() => setCreating(false)} />}
    </>
  )
}
