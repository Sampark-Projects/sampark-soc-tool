import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getJSON, netboxChoices, netboxWrite } from '../api'
import { flatten } from '../lib/query'
import PageHero from '../components/PageHero'

// Detail view for a NetBox object (device, IP address, prefix, site) with edit/delete of the simple fields.
const KINDS: Record<string, { label: string; api: string; ui: string; tab: string }> = {
  devices: { label: 'Device', api: '/netbox/api/dcim/devices/', ui: '/assetregistry/dcim/devices/', tab: 'devices' },
  ips: { label: 'IP address', api: '/netbox/api/ipam/ip-addresses/', ui: '/assetregistry/ipam/ip-addresses/', tab: 'ips' },
  prefixes: { label: 'Prefix', api: '/netbox/api/ipam/prefixes/', ui: '/assetregistry/ipam/prefixes/', tab: 'prefixes' },
  sites: { label: 'Site', api: '/netbox/api/dcim/sites/', ui: '/assetregistry/dcim/sites/', tab: 'sites' },
}

// Fields that are noise in a quick-look view.
const HIDE = /(^|\.)(url|display_url|_depth|custom_fields|tags|created|last_updated|config_context|local_context_data)(\.|$)/

// Fields that can be edited here. Anything needing related objects (device type, role, site, VRF, ...) is
// edited in NetBox itself, where the pickers for those live.
interface EditField {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'status'
}
// NetBox's standard statuses, used when the live choice list can't be read (a proxy that swallows OPTIONS, say)
const FALLBACK_STATUS: Record<string, string[]> = {
  devices: ['offline', 'active', 'planned', 'staged', 'failed', 'inventory', 'decommissioning'],
  ips: ['active', 'reserved', 'deprecated', 'dhcp', 'slaac'],
  prefixes: ['container', 'active', 'reserved', 'deprecated'],
  sites: ['planned', 'staging', 'active', 'decommissioning', 'retired'],
}
const EDITABLE: Record<string, EditField[]> = {
  devices: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'serial', label: 'Serial number', kind: 'text' },
    { key: 'asset_tag', label: 'Asset tag', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'comments', label: 'Comments', kind: 'textarea' },
  ],
  ips: [
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'dns_name', label: 'DNS name', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'comments', label: 'Comments', kind: 'textarea' },
  ],
  prefixes: [
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'comments', label: 'Comments', kind: 'textarea' },
  ],
  sites: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'comments', label: 'Comments', kind: 'textarea' },
  ],
}

const current = (data: any, f: EditField): string => {
  const v = data?.[f.key]
  if (f.kind === 'status') return String(v?.value ?? String(v?.label ?? '').toLowerCase())
  return v == null ? '' : String(v)
}

const IPV4 = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/

export default function AssetDetail() {
  const { kind = '', id = '' } = useParams()
  const k = KINDS[kind]
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [statuses, setStatuses] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!k) return
    let alive = true
    setData(null)
    setError(null)
    getJSON(`${k.api}${encodeURIComponent(id)}/`)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [k, id])

  const fields = EDITABLE[kind] ?? []

  const startEdit = () => {
    setSaveError(null)
    setNotice(null)
    setForm(Object.fromEntries(fields.map((f) => [f.key, current(data, f)])))
    setEditing(true)
    if (k && fields.some((f) => f.kind === 'status') && statuses.length === 0) netboxChoices(k.api, 'status').then((c) =>
        setStatuses(c.length ? c : (FALLBACK_STATUS[kind] ?? []).map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))),
      )
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!k) return
    const changes: Record<string, string> = {}
    for (const f of fields) if (form[f.key] !== current(data, f) && !(f.kind === 'status' && !form[f.key])) changes[f.key] = form[f.key]
    if (Object.keys(changes).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await netboxWrite('PATCH', `${k.api}${encodeURIComponent(id)}/`, changes)
      setData(updated ?? data)
      setEditing(false)
      setNotice('Saved.')
    } catch (err: any) {
      const forbidden = err?.status === 403
      setSaveError(
        forbidden
          ? `AssetRegistry refused the change (${err.message}). Your user may not have permission to edit this, or the page needs a fresh load — try opening it in AssetRegistry.`
          : err.message ?? String(err),
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!k) return
    if (!window.confirm(`Delete this ${k.label.toLowerCase()} from AssetRegistry? This cannot be undone.`)) return
    setSaveError(null)
    try {
      await netboxWrite('DELETE', `${k.api}${encodeURIComponent(id)}/`)
      navigate(`/assets?tab=${k.tab}`)
    } catch (err: any) {
      setSaveError(err.message ?? String(err))
    }
  }

  if (!k) return <p className="err">Unknown asset type “{kind}”.</p>

  const flat = data ? flatten(data) : {}
  const rows = Object.entries(flat).filter(([key, v]) => !HIDE.test(key) && v !== '' && v !== null && v !== undefined)
  const addr = String(flat['address'] ?? flat['primary_ip.address'] ?? flat['primary_ip4.address'] ?? '')
  const ip = IPV4.exec(addr)?.[1]
  const title = String(flat['display'] ?? flat['name'] ?? flat['address'] ?? flat['prefix'] ?? `${k.label} ${id}`)

  return (
    <>
      <div className="crumbs">
        <Link to={`/assets?tab=${k.tab}`}>Assets</Link> / {k.label}
      </div>
      <PageHero icon="🗺️" title={title} sub={k.label} href={`${k.ui}${id}/`} linkLabel="Open AssetRegistry ↗" />
      {error && <p className="err">Could not load: {error}</p>}
      {data && !editing && fields.length > 0 && (
        <div className="toolbar">
          <button className="btn" onClick={startEdit}>
            Edit
          </button>
          <button className="btn" onClick={remove}>
            Delete
          </button>
          {notice && <span className="muted">{notice}</span>}
        </div>
      )}
      {saveError && (
        <p className="err">
          {saveError}{' '}
          <a href={`${k.ui}${id}/edit/`} className="link-out">
            Edit in AssetRegistry ↗
          </a>
        </p>
      )}
      {data && editing && (
        <form className="card" onSubmit={save}>
          <div className="form-grid">
            {fields
              .filter((f) => f.kind !== 'textarea')
              .map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.kind === 'status' ? (
                    <select value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      {!statuses.some((s) => s.value === form[f.key]) && <option value={form[f.key] ?? ''}>{form[f.key] || '—'}</option>}
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                </label>
              ))}
          </div>
          {fields
            .filter((f) => f.kind === 'textarea')
            .map((f) => (
              <label key={f.key}>
                {f.label}
                <textarea rows={4} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </label>
            ))}
          <div className="toolbar">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn" type="button" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {ip && (
        <div className="toolbar">
          <Link to={`/sessions?expression=${encodeURIComponent(`ip == ${ip}`)}`}>Sessions for {ip}</Link>
        </div>
      )}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <div className="card table-wrap">
          <table>
            <tbody>
              {rows.map(([key, v]) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
