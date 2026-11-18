import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHero from '../components/PageHero'
import RangeSelect from '../components/RangeSelect'
import { inRange } from '../lib/query'

// Browser for the extracted-files server. nginx serves GET /extracted-files/<path>/ as an HTML
// directory listing, so we fetch it and read the links out of it (no JSON API exists).
const ROOT = '/extracted-files/'

interface Entry {
  name: string
  href: string
  isDir: boolean
  modified: number
}

function parseListing(html: string, base: string): Entry[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: Entry[] = []
  doc.querySelectorAll('a[href]').forEach((a) => {
    const raw = a.getAttribute('href') ?? ''
    if (!raw || raw.startsWith('?') || raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('http') || raw.startsWith('..')) return
    const isDir = raw.endsWith('/')
    let name = raw
    try {
      name = decodeURIComponent(raw)
    } catch {
      /* keep raw */
    }
    // nginx lists "dd-Mon-yyyy hh:mm  size" as the text right after each link
    const tail = (a.nextSibling?.textContent ?? '').trim()
    const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2})/.exec(tail)
    const modified = m ? Date.parse(`${m[1]} ${m[2]} ${m[3]} ${m[4]}:${m[5]} UTC`) || 0 : 0
    out.push({ name: isDir ? name.slice(0, -1) : name, href: base + raw, isDir, modified })
  })
  return out.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
}

export default function Files() {
  const [params, setParams] = useSearchParams()
  const path = params.get('path') ?? ''
  const base = ROOT + path
  const [entries, setEntries] = useState<Entry[]>([])
  const [filter, setFilter] = useState('')
  const [range, setRange] = useState('1h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetch(base, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((t) => alive && setEntries(parseListing(t, base)))
      .catch((e) => alive && (setError(String(e.message ?? e)), setEntries([])))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [base])

  const crumbs = path.split('/').filter(Boolean)
  const shown = entries.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()) && (range === 'all' || inRange(e.modified, range)))

  return (
    <>
      <PageHero icon="🗄️" title="Extracted Files" sub="Files carved from network traffic and scanned by the system." href="/extracted-files/" linkLabel="Open original listing ↗" />

      <div className="crumbs">
        <button className="link" onClick={() => setParams({})}>
          extracted-files
        </button>
        {crumbs.map((c, i) => (
          <span key={i}>
            {' / '}
            <button className="link" onClick={() => setParams({ path: crumbs.slice(0, i + 1).join('/') + '/' })}>
              {c}
            </button>
          </span>
        ))}
      </div>

      <div className="toolbar card">
        <input style={{ flex: 1 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" aria-label="Filter" />
        <RangeSelect value={range} onChange={setRange} label="Modified within" />
      </div>

      {error && <p className="err">Could not load files: {error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Modified</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Empty
                </td>
              </tr>
            )}
            {shown.map((e) => (
              <tr key={e.href}>
                <td>
                  {e.isDir ? (
                    <button className="link" onClick={() => setParams({ path: path + e.name + '/' })}>
                      📁 {e.name}
                    </button>
                  ) : (
                    <span>📄 {e.name}</span>
                  )}
                </td>
                <td className="muted">{e.isDir ? 'Folder' : 'File'}</td>
                <td className="muted small">{e.modified ? new Date(e.modified).toLocaleString() : '—'}</td>
                <td>{!e.isDir && <a href={e.href} download>Download</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
