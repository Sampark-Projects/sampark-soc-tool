// Small fetch helper shared by the data pages. All calls are same-origin (nginx
// proxies /mapi, /arkime, /netbox, /extracted-files and adds authentication).
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function getJSON<T = any>(
  url: string,
  params?: Record<string, string | number | undefined>,
  opts?: { sampleOnError?: boolean },
): Promise<T> {
  const qs = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  let res = await fetch(url + qs, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (res.status >= 500 && url.startsWith('/mapi/')) {
    // the backend API answers some aggregations with an intermittent 500; one retry clears those
    await new Promise((r) => setTimeout(r, 400))
    res = await fetch(url + qs, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  }
  if (!res.ok && opts?.sampleOnError && res.status >= 500 && url.startsWith('/mapi/agg/')) {
    const sampled = await sampledAgg(url, params).catch(() => null)
    if (sampled) return sampled as T
  }
  if (!res.ok) throw new ApiError(res.status, `${url} returned HTTP ${res.status}`)
  const json = await res.json()
  return (url.startsWith('/mapi/agg') ? stripMissingBuckets(json) : json) as T
}

// Write calls (POST/PUT/DELETE with a JSON body), used for the Arkime viewer API.
// Arkime answers {success, text}. If its anti-CSRF cookie is visible to this page it is sent along.
export async function sendJSON<T = any>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  const token = document.cookie.split('; ').find((c) => c.startsWith('ARKIME-COOKIE='))?.slice('ARKIME-COOKIE='.length)
  if (token) headers['x-arkime-cookie'] = decodeURIComponent(token)
  const res = await fetch(url, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) })
  let json: any = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON reply */
  }
  if (!res.ok || json?.success === false) throw new ApiError(res.status, json?.text || `${url} returned HTTP ${res.status}`)
  return json as T
}

// NetBox writes. NetBox's REST API accepts the logged-in session, but Django requires a CSRF token on
// writes: it lives in the "csrftoken" cookie, which NetBox sets when it serves an HTML page, so fetch
// one page first if the cookie isn't there yet.
const csrfCookie = () => document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.slice('csrftoken='.length)

function netboxMessage(json: any, status: number, url: string): string {
  if (json && typeof json === 'object') {
    if (typeof json.detail === 'string') return json.detail
    const parts = Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : JSON.stringify(v)}`)
    if (parts.length) return parts.join('; ')
  }
  return `${url} returned HTTP ${status}`
}

export async function netboxWrite<T = any>(method: 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T | null> {
  const attempt = async (refresh: boolean) => {
    let token = csrfCookie()
    if (!token || refresh) {
      // NetBox sets/renews the csrftoken cookie when it serves a page
      await fetch('/netbox/login/', { credentials: 'same-origin' }).catch(() => undefined)
      token = csrfCookie()
    }
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['X-CSRFToken'] = decodeURIComponent(token)
    return fetch(url, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) })
  }
  let res = await attempt(false)
  if (res.status === 403) {
    // a stale token is the usual cause of a CSRF refusal: renew it and try once more
    const text = await res.clone().text()
    if (/csrf/i.test(text)) res = await attempt(true)
  }
  if (res.status === 204) return null
  let json: any = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON reply */
  }
  if (!res.ok) throw new ApiError(res.status, netboxMessage(json, res.status, url))
  return json as T
}

// Choice lists for a NetBox endpoint (e.g. valid "status" values), read from the OPTIONS response.
export async function netboxChoices(url: string, field: string): Promise<{ value: string; label: string }[]> {
  try {
    const res = await fetch(url, { method: 'OPTIONS', headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    const json = await res.json()
    const ch = json?.actions?.POST?.[field]?.choices ?? json?.actions?.PUT?.[field]?.choices ?? []
    return ch.map((c: any) => ({ value: String(c.value), label: String(c.display_name ?? c.label ?? c.value) }))
  } catch {
    return []
  }
}

// /mapi/agg labels documents that lack the field with a placeholder bucket: "-" for text,
// "0.0.0.0" for IPs and 0 for numbers. Those are "no value", not real values, so drop them
// (at every nesting level) like the original dashboards do.
function stripMissingBuckets(node: any): any {
  if (!node || typeof node !== 'object') return node
  for (const [field, v] of Object.entries(node)) {
    const buckets = (v as any)?.buckets
    if (!Array.isArray(buckets)) continue
    const keep = buckets.filter((b: any) => {
      const key = b?.key
      if (key === '-' || key === '0.0.0.0') return false
      if (key === 0 && /(^|\.)(port|bytes|packets|duration|size)$/i.test(field)) return false
      return true
    })
    for (const b of keep) stripMissingBuckets(b)
    ;(v as any).buckets = keep
  }
  return node
}

export function formatBytes(n: number) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1)
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

export function formatTime(ms: number | string | undefined) {
  if (!ms) return ''
  const d = new Date(typeof ms === 'string' && !/^\d+$/.test(ms) ? ms : Number(ms))
  return isNaN(d.getTime()) ? String(ms) : d.toLocaleString()
}

// Return the first present value among several possible keys (APIs differ between versions).
export function pick(row: Record<string, any>, keys: string[]): any {
  for (const k of keys) {
    const v = k.includes('.') && !(k in row) ? k.split('.').reduce((o, p) => (o ? o[p] : undefined), row) : row[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}


// When the server cannot aggregate a field (it answers HTTP 500 for fields that are not aggregatable in
// every index), count the values in the newest documents instead. The result has the same shape as
// /mapi/agg, plus `sampled: <number of documents counted>` so the panel can say it is an approximation.
const SAMPLE_SIZE = 500

function valuesAt(src: any, path: string): string[] {
  let cur: any = src
  if (src && src[path] !== undefined) cur = src[path]
  else
    for (const k of path.split('.')) {
      if (cur == null) return []
      cur = Array.isArray(cur) ? cur.flatMap((c) => (c == null ? [] : [c[k]])) : cur[k]
    }
  const flat = (Array.isArray(cur) ? cur.flat(3) : [cur]).filter((v) => v !== undefined && v !== null && v !== '' && typeof v !== 'object')
  return flat.map(String)
}

function group(docs: any[], fields: string[], limit: number): any {
  const counts = new Map<string, any[]>()
  for (const d of docs)
    for (const v of new Set(valuesAt(d._source ?? d, fields[0]))) {
      if (!counts.has(v)) counts.set(v, [])
      counts.get(v)!.push(d)
    }
  const buckets = Array.from(counts.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([key, ds]) => {
      const b: any = { key, doc_count: ds.length }
      if (fields.length > 1) b[fields[1]] = group(ds, fields.slice(1), limit)
      return b
    })
  return { buckets }
}

async function sampledAgg(url: string, params?: Record<string, string | number | undefined>): Promise<any> {
  const fields = decodeURIComponent(url.slice('/mapi/agg/'.length)).split(',')
  const merged: Record<string, string | number | undefined> = { ...params, limit: SAMPLE_SIZE }
  const qs = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const res = await fetch(`/mapi/document?${qs}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!res.ok) throw new ApiError(res.status, 'document sample failed')
  const docs: any[] = (await res.json())?.results ?? []
  const limit = Number(params?.limit ?? 10)
  return { fields, [fields[0]]: group(docs, fields, limit), sampled: docs.length }
}

export const sampledNote = (n: number) =>
  n === 0 ? 'No matching events (the server could not aggregate this field).' : `Counted from the latest ${n} events: the server could not aggregate this field.`

// Calls the search engine through the dashboards backend's console proxy (what Dev Tools uses), so the UI can read
// monitors, detectors, channels and run queries without opening the original app.
export async function osProxy(method: string, path: string, body?: unknown): Promise<{ status: number; text: string; json: any }> {
  const res = await fetch(`/dashboards/api/console/proxy?path=${encodeURIComponent(path)}&method=${encodeURIComponent(method)}`, {
    method: 'POST',
    headers: { 'osd-xsrf': 'true', 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined || body === '' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* plain-text answers (e.g. _cat) stay as text */
  }
  return { status: res.status, text, json }
}

export async function savedObject(type: string, id: string): Promise<any> {
  return getJSON(`/dashboards/api/saved_objects/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)
}
