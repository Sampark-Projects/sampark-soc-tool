import { useCallback, useEffect, useRef, useState } from 'react'
import PageHero from '../components/PageHero'
import { niceName } from '../lib/relabel'

// Existing PHP endpoint (file-upload/php/submit.php) is served by nginx under /upload/.
const SUBMIT_URL = '/upload/server/php/submit.php'
const MAX_TAGS = 16

type Readiness = Record<string, boolean>
type Sites = Record<string, { display?: string; name?: string; slug?: string }>

function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < units.length - 1)
  return `${n.toFixed(1)} ${units[i]}`
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const t = raw.trim()
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) onChange([...tags, t])
    setText('')
  }

  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        placeholder={tags.length ? '' : 'User-defined tags (press Enter)'}
        aria-label="User-defined tags"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(text)
          } else if (e.key === 'Backspace' && !text && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={() => add(text)}
      />
    </div>
  )
}

export default function Upload() {
  const [files, setFiles] = useState<File[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [sites, setSites] = useState<{ id: number; text: string }[]>([])
  const [site, setSite] = useState('0')
  const [ready, setReady] = useState<Readiness | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    fetch('/mapi/netbox-sites')
      .then((r) => r.json())
      .then((data: Sites) => {
        const list = Object.entries(data).map(([id, s]) => ({
          id: parseInt(id, 10),
          text: s.display || s.name || s.slug || `Site ${id}`,
        }))
        setSites(list)
        if (list.length) setSite(String(Math.min(...list.map((s) => s.id))))
      })
      .catch(() => setSites([]))
    fetch('/mapi/ready')
      .then((r) => r.json())
      .then(setReady)
      .catch(() => setReady(null))
  }, [])

  useEffect(refresh, [refresh])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setMessage(null)
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  const uploading = progress !== null
  const essentialReady = ready
    ? !!(ready.arkime && ready.logstash_lumberjack && ready.logstash_pipelines && ready.opensearch && ready.pcap_monitor)
    : null

  const commit = () => {
    if (!files.length || uploading) return
    const fd = new FormData()
    files.forEach((f) => fd.append('filepond[]', f, f.name))
    fd.append('tags', tags.join(','))
    fd.append('site-dropdown', site)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', SUBMIT_URL)
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      setProgress(null)
      if (xhr.status >= 200 && xhr.status < 400) {
        setMessage({ ok: true, text: `Uploaded ${files.length} file(s). They will be processed shortly.` })
        setFiles([])
      } else {
        setMessage({ ok: false, text: `Upload failed (HTTP ${xhr.status}).` })
      }
    }
    xhr.onerror = () => {
      setProgress(null)
      setMessage({ ok: false, text: 'Upload failed: network error.' })
    }
    setProgress(0)
    setMessage(null)
    xhr.send(fd)
  }

  return (
    <section className="card upload">
      <PageHero icon="⬆️" title="Artifact Upload" sub="Upload PCAP files, archived ProtocolInspector logs, or other supported analysis artifacts." />

      <div className="upload-options">
        <TagInput tags={tags} onChange={setTags} />
        {sites.length > 0 && (
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="AssetRegistry site" title="AssetRegistry site">
            <option value="0">No AssetRegistry Enrichment</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.text}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        className={`dropzone${dragging ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        Drag &amp; drop files here or <u>browse</u>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span>{f.name}</span>
              <span className="muted">{formatSize(f.size)}</span>
              <button type="button" className="link" disabled={uploading} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploading && (
        <div className="progress" role="progressbar" aria-valuenow={progress ?? 0}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && <p className={message.ok ? 'ok' : 'err'}>{message.text}</p>}

      <button className="btn" disabled={!files.length || uploading} onClick={commit}>
        {uploading ? `Uploading… ${progress}%` : 'Commit Uploaded Files'}
      </button>

      <footer className="readiness" onClick={refresh} title="Click to refresh">
        {essentialReady === null ? '' : essentialReady ? '✅ Ready for file uploads' : '❌ Not ready for file uploads 🔄'}
        {ready && (
          <div className="readiness-details">
            {Object.entries(ready).map(([k, v]) => (
              <div key={k}>
                <span>{niceName(k)}</span>
                <span>{v ? '✅' : '❌'}</span>
              </div>
            ))}
          </div>
        )}
      </footer>
    </section>
  )
}
