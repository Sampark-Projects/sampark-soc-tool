import { FormEvent, useEffect, useState } from 'react'
import { getJSON, sendJSON } from '../api'
import PageHero from '../components/PageHero'

// Your Arkime viewer preferences: GET/POST /arkime/api/user/settings.
// Only simple options are editable here; every other stored setting (theme, table layouts, ...) is
// read back and sent unchanged so saving never drops anything.
type Settings = Record<string, any>

const SELECTS: { key: string; label: string; options: [string, string][] }[] = [
  { key: 'timezone', label: 'Time zone', options: [['local', 'Local'], ['gmt', 'UTC']] },
  { key: 'detailFormat', label: 'Session detail format', options: [['last', 'Last used'], ['natural', 'Natural'], ['ascii', 'ASCII'], ['utf8', 'UTF-8'], ['hex', 'Hex']] },
  { key: 'showTimestamps', label: 'Packet timestamps', options: [['last', 'Last used'], ['on', 'Show'], ['off', 'Hide']] },
  { key: 'sortDirection', label: 'Sessions sort order', options: [['desc', 'Newest first'], ['asc', 'Oldest first']] },
  { key: 'numPackets', label: 'Packets shown per session', options: [['last', 'Last used'], ['50', '50'], ['200', '200'], ['500', '500'], ['1000', '1000']] },
]
const TEXTS: { key: string; label: string; hint?: string }[] = [
  { key: 'sortColumn', label: 'Sessions sort column', hint: 'e.g. firstPacket' },
  { key: 'spiGraph', label: 'SPI Graph field', hint: 'e.g. protocol' },
  { key: 'connSrcField', label: 'Connections source field' },
  { key: 'connDstField', label: 'Connections destination field' },
]

export default function ArkimeSettings() {
  const [orig, setOrig] = useState<Settings | null>(null)
  const [form, setForm] = useState<Settings>({})
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getJSON('/arkime/api/user/settings')
      .then((r) => {
        setOrig(r ?? {})
        setForm(r ?? {})
      })
      .catch((e) => setError(e.message ?? String(e)))
  }, [])

  const set = (k: string, v: any) => {
    setMsg(null)
    setForm((f) => ({ ...f, [k]: v }))
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await sendJSON('POST', '/arkime/api/user/settings', { ...(orig ?? {}), ...form })
      setOrig({ ...(orig ?? {}), ...form })
      setMsg('Saved.')
    } catch (err: any) {
      setError(err.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  const dirty = JSON.stringify(orig) !== JSON.stringify(form)

  return (
    <>
      <PageHero icon="⚙️" title="PCAP & Indexing settings" sub="Display preferences for the viewer, applied to your user." href="/arkime/settings" linkLabel="All settings ↗" />
      {error && (
        <p className="err">
          {error}{' '}
          <a href="/arkime/settings" className="link-out">
            Change it in Arkime ↗
          </a>
        </p>
      )}
      {!orig && !error && <p className="muted">Loading…</p>}
      {orig && (
        <form className="card" onSubmit={save}>
          <div className="form-grid">
            {SELECTS.map((f) => {
              const cur = String(form[f.key] ?? f.options[0][0])
              const known = f.options.some(([v]) => v === cur)
              return (
                <label key={f.key}>
                  {f.label}
                  <select value={cur} onChange={(e) => set(f.key, e.target.value)}>
                    {!known && <option value={cur}>{cur}</option>}
                    {f.options.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
            {TEXTS.map((f) => (
              <label key={f.key}>
                {f.label}
                <input type="text" value={String(form[f.key] ?? '')} placeholder={f.hint} onChange={(e) => set(f.key, e.target.value)} />
              </label>
            ))}
          </div>
          <p>
            <label style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={!!form.manualQuery} onChange={(e) => set('manualQuery', e.target.checked)} /> Search only when I press Search (manual query)
            </label>
          </p>
          <div className="toolbar">
            <button className="btn" type="submit" disabled={busy || !dirty}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="btn" type="button" disabled={!dirty} onClick={() => setForm(orig)}>
              Reset
            </button>
            {msg && <span className="muted">{msg}</span>}
          </div>
        </form>
      )}
    </>
  )
}
