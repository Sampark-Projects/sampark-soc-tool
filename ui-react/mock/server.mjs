// Minimal fake Sampark SOC Tool backend for UI development (no Docker needed).
// Serves synthetic data for /mapi, /arkime/api, /netbox/api, /extracted-files and the upload endpoint.
import http from 'node:http'

let seed = 42
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const choice = (a) => a[Math.floor(rnd() * a.length)]
const N = 4000
const NOW = Date.now()
const hosts = Array.from({ length: 24 }, (_, i) => `10.0.${i % 4}.${10 + i}`)
const ext = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '142.250.80.46', '151.101.1.69', '172.217.14.206']
const protos = [['dns', 'udp', 53], ['http', 'tcp', 80], ['tls', 'tcp', 443], ['ssh', 'tcp', 22], ['smb', 'tcp', 445], ['modbus', 'tcp', 502], ['ntp', 'udp', 123]]
const datasets = { dns: 'dns', http: 'http', tls: 'ssl', ssh: 'ssh', smb: 'smb_files', modbus: 'modbus', ntp: 'ntp' }

const docs = Array.from({ length: N }, (_, i) => {
  const [p, t, port] = choice(protos)
  const src = choice(hosts)
  const dst = rnd() < 0.5 ? choice(ext) : choice(hosts)
  const ts = NOW - Math.floor(rnd() * 7 * 86400000)
  const zeek = rnd() < 0.8
  return {
    _id: `doc${i}`,
    _source: {
      '@timestamp': new Date(ts).toISOString(),
      'event.provider': zeek ? 'zeek' : 'suricata',
      'event.dataset': datasets[p],
      'network.protocol': p,
      'network.transport': t,
      'network.protocol_version': choice(['1', '2c', '3']),
      'network.type': 'ipv4',
      'event.action': choice(['GET', 'POST', 'query', 'read', 'write']),
      'event.result': choice(['200', '404', 'success', 'failure']),
      'event.severity': Math.floor(rnd() * 100),
      'network.direction': choice(['internal', 'outbound', 'inbound']),
      'source.ip': src,
      'source.port': 30000 + Math.floor(rnd() * 30000),
      'source.oui': choice(['Dell', 'Cisco', 'VMware', 'Siemens']),
      'source.segment.name': 'lan',
      'destination.ip': dst,
      'destination.port': port,
      'destination.oui': choice(['Cisco', 'Juniper', 'Rockwell']),
      'destination.segment.name': dst.startsWith('10.') ? 'lan' : 'internet',
      'source.geo.country_iso_code': choice(['IN', 'US', 'DE']),
      'destination.geo.country_iso_code': dst.startsWith('10.') ? undefined : choice(['US', 'DE', 'GB']),
      'destination.geo.country_code2': dst.startsWith('10.') ? undefined : choice(['US', 'DE', 'GB']),
      'destination.geo.country_name': dst.startsWith('10.') ? undefined : choice(['United States', 'Germany']),
      'network.bytes': Math.floor(rnd() * 90000),
      'network.packets': Math.floor(rnd() * 400),
      tags: choice([['internal_source'], ['external_destination'], ['ics']]),
    },
    ts,
  }
})
// Purdue zones on industrial traffic (feeds the Biomes dashboard)
const zones = ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'DMZ']
for (const d of docs) {
  const ics = d._source['network.protocol'] === 'modbus'
  if (ics || rnd() < 0.15) {
    d._source['source.device.purdue_zone'] = choice(zones)
    d._source['destination.device.purdue_zone'] = choice(zones)
  }
}
// Strelka extracted files forming parent/child trees (feeds the File Tree dashboard)
const fileTrees = [
  ['invoice.zip', [['invoice.pdf', 'application/pdf'], ['macro.docm', 'application/vnd.ms-word', [['vbaProject.bin', 'application/x-ole-storage'], ['payload.ps1', 'text/plain']]]]],
  ['update.tar.gz', [['update.tar', 'application/x-tar', [['setup.exe', 'application/x-dosexec'], ['readme.txt', 'text/plain']]]]],
  ['photo.jpg', []],
  ['report.xlsx', [['sheet1.xml', 'text/xml'], ['vbaProject.bin', 'application/x-ole-storage']]],
  ['firmware.bin', [['bootloader.img', 'application/octet-stream'], ['rootfs.squashfs', 'application/x-squashfs']]],
]
let nid = 0
fileTrees.forEach(([rootName, kids], ti) => {
  const rootId = `root${ti}`
  const ts = NOW - Math.floor(rnd() * 5 * 86400000)
  const add = (name, mime, parent, depth) => {
    const id = parent ? `n${nid++}` : rootId
    docs.push({
      _id: `file${id}`,
      ts,
      _source: {
        '@timestamp': new Date(ts).toISOString(),
        'event.provider': 'filescan',
        'event.dataset': 'strelka',
        'filescan.tree.node': id,
        'filescan.tree.parent': parent ?? undefined,
        'filescan.tree.root': rootId,
        'filescan.tree.depth': depth,
        'file.name': name,
        'file.mime_type': mime,
        'source.ip': choice(hosts),
        'destination.ip': choice(hosts),
      },
    })
    return id
  }
  add(rootName, 'application/zip', null, 0)
  const walk = (list, parent, depth) => list.forEach(([n, m, sub]) => { const id = add(n, m, parent, depth); if (sub) walk(sub, id, depth + 1) })
  walk(kids, rootId, 1)
})
const fields = Object.fromEntries(Object.keys(docs[0]._source).map((k) => [k, { type: 'keyword', description: `Mock field ${k}` }]))

const prefixes = [{ id: 1, prefix: '10.0.0.0/22', status: { value: 'active', label: 'Active' }, site: { name: 'HQ' }, description: '' }]
const sites = [{ id: 1, name: 'HQ', status: { value: 'active', label: 'Active' }, description: '' }, { id: 2, name: 'Plant', status: { value: 'active', label: 'Active' }, description: '' }]
const hunts = [{ id: 'h1', name: 'Find mimikatz', status: 'finished', search: 'mimikatz', searchType: 'ascii', matchedSessions: 3, searchedSessions: 1000, totalSessions: 1000, created: NOW - 86400000, query: { expression: 'ip.dst == 8.8.8.8' } }]
let userSettings = { timezone: 'local', detailFormat: 'last', showTimestamps: 'last', sortColumn: 'firstPacket', sortDirection: 'desc', spiGraph: 'protocol', connSrcField: 'source.ip', connDstField: 'destination.ip', numPackets: 'last', manualQuery: false, theme: 'default-theme' }
const readBody = (req) => new Promise((r) => { let t = ''; req.on('data', (c) => (t += c)); req.on('end', () => { try { r(JSON.parse(t || '{}')) } catch { r({}) } }) })
const parseFilter = (s) => { try { return s ? JSON.parse(s) : {} } catch { return {} } }
const val = (d, f) => d._source[f]
function select(q) {
  const from = q.get('from') ? Number(q.get('from')) * 1000 : 0
  const to = q.get('to') ? Number(q.get('to')) * 1000 : Infinity
  const filter = parseFilter(q.get('filter'))
  return docs.filter((d) => {
    if (d.ts < from || d.ts > to) return false
    return Object.entries(filter).every(([k, want]) => {
      const neg = k.startsWith('!')
      const f = neg ? k.slice(1) : k
      const have = val(d, f)
      const hv = Array.isArray(have) ? have : have === undefined ? [null] : [have]
      const wv = Array.isArray(want) ? want : [want]
      const hit = hv.some((h) => wv.some((w) => (w === null ? h === null : String(h) === String(w))))
      return neg ? !hit : hit
    })
  })
}
function agg(rows, fields, limit) {
  const [f, ...rest] = fields
  const m = new Map()
  for (const d of rows) {
    const v = val(d, f)
    // like the real API, documents without the field land in a placeholder bucket
    const missing = /\.ip$/.test(f) ? '0.0.0.0' : /\.(port|bytes|packets)$/.test(f) ? 0 : '-'
    for (const k of Array.isArray(v) ? v : v === undefined ? [missing] : [v]) (m.get(k) ?? m.set(k, []).get(k)).push(d)
  }
  return {
    buckets: [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, limit).map(([key, r]) => ({
      key, doc_count: r.length, ...(rest.length ? { [rest[0]]: agg(r, rest, limit) } : {}),
    })),
  }
}
const nest = (rows, fs, limit) => ({ [fs[0]]: agg(rows, fs, limit) })
const send = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }

const page = (q, items) => {
  const off = Number(q.get('offset') ?? q.get('start') ?? 0), lim = Number(q.get('limit') ?? q.get('length') ?? 25)
  return items.slice(off, off + lim)
}
const devices = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, name: `host-${i + 1}`, status: { value: 'active', label: 'Active' }, site: { name: 'HQ' }, role: { name: 'Server' }, device_type: { model: 'Generic' }, primary_ip: { address: `${hosts[i]}/24` } }))
const ips = hosts.map((h, i) => ({ id: i + 1, address: `${h}/24`, status: { value: 'active', label: 'Active' }, dns_name: `host-${i + 1}.lan`, assigned_object: { name: `eth0` } }))
const nb = (q, rows) => ({ count: rows.length, results: page(q, rows) })

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const q = u.searchParams; const p = u.pathname
  if (p === '/mapi/ready') return send(res, { opensearch: true, pcap_monitor: true, logstash_lumberjack: true, logstash_pipelines: true, dashboards: true, netbox: true })
  if (p === '/mapi/version') return send(res, { mode: 'mock', built: '2026-01-01', boot_time: new Date(NOW - 3600000).toISOString(), machine: 'mock-host', opensearch: { version: { number: '2.x-mock' }, health: { status: 'green', number_of_nodes: 1, unassigned_shards: 0 } } })
  if (p === '/mapi/ingest-stats') return send(res, { sources: { 'mock-sensor-1': new Date(NOW - 20000).toISOString(), 'mock-sensor-2': new Date(NOW - 600000).toISOString() }, latest_ingest_age_seconds: 20 })
  if (p === '/mapi/indices') return send(res, { indices: [{ index: 'arkime_sessions3-260101', 'docs.count': String(N), 'store.size': '12mb', health: 'green', status: 'open', uuid: 'a' }, { index: 'malcolm_beats_zeek_260101', 'docs.count': '9000', 'store.size': '30mb', health: 'green', status: 'open', uuid: 'b' }] })
  if (p === '/mapi/fields') return send(res, { fields, total: Object.keys(fields).length })
  if (p === '/mapi/netbox-sites') return send(res, { 1: { name: 'HQ', display: 'HQ', slug: 'hq' }, 2: { name: 'Plant', display: 'Plant', slug: 'plant' } })
  if (p.startsWith('/mapi/agg/')) {
    const fs = decodeURIComponent(p.slice(10)).split(',')
    return send(res, { ...nest(select(q), fs, Number(q.get('limit') ?? 10)), range: [], filter: {}, shards: {}, timed_out: false })
  }
  if (p === '/mapi/document') {
    let rows = select(q)
    const sort = q.get('sort'); if (sort) { const desc = sort.startsWith('-'); const f = sort.replace(/^[-+]/, ''); rows = [...rows].sort((a, b) => (String(val(a, f)) < String(val(b, f)) ? -1 : 1) * (desc ? -1 : 1)) }
    return send(res, { results: Number(q.get('limit') ?? 25) === 0 ? [] : page(q, rows).map(({ _id, _source }) => ({ _id, _source })), total: { value: rows.length, relation: 'eq' } })
  }
  if (p === '/arkime/api/stats') return send(res, { recordsTotal: 2, data: [{ nodeName: 'mock-sensor-1', totalSessions: 120345, totalPackets: 9876543, deltaPacketsPerSec: 850, deltaBytesPerSec: 640000, deltaDroppedPerSec: 0, freeSpaceM: 250000, currentTime: Math.floor(NOW / 1000) }, { nodeName: 'mock-sensor-2', totalSessions: 5432, totalPackets: 400123, deltaPacketsPerSec: 12, deltaBytesPerSec: 8000, deltaDroppedPerSec: 1, freeSpaceM: 90000, currentTime: Math.floor(NOW / 1000) - 600 }] })
  if (p === '/arkime/api/hunts') return send(res, { recordsTotal: hunts.length, data: hunts })
  if (p === '/arkime/api/hunt' && req.method === 'POST') {
    return readBody(req).then((b) => {
      if (!b.name || !b.search || !b.totalSessions) return send(res, { success: false, text: 'Missing name, search or totalSessions' }, 400)
      const h = { id: `h${hunts.length + 1}`, name: b.name, status: 'queued', search: b.search, searchType: b.searchType, type: b.type, matchedSessions: 0, searchedSessions: 0, totalSessions: b.totalSessions, created: Date.now(), query: b.query ?? {} }
      hunts.unshift(h)
      send(res, { success: true, hunt: h })
    })
  }
  const hact = /^\/arkime\/api\/hunt\/([^/]+)(?:\/(pause|play))?$/.exec(p)
  if (hact && (req.method === 'PUT' || req.method === 'DELETE')) {
    const i = hunts.findIndex((h) => h.id === hact[1])
    if (i < 0) return send(res, { success: false, text: 'Hunt not found' }, 404)
    if (req.method === 'DELETE') hunts.splice(i, 1)
    else hunts[i].status = hact[2] === 'pause' ? 'paused' : 'running'
    return send(res, { success: true, text: 'OK' })
  }
  if (p === '/arkime/api/user/settings') {
    if (req.method === 'POST') return readBody(req).then((b) => { userSettings = b; send(res, { success: true, text: 'Updated user settings successfully' }) })
    return send(res, userSettings)
  }
  const pk = /^\/arkime\/api\/session\/([^/]+)\/([^/]+)\/packets$/.exec(p)
  if (pk) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(`<html><body style="font-family:monospace"><b>Packet 1</b><pre>00000000  47 45 54 20 2f 20 48 54  54 50 2f 31 2e 31 0d 0a  GET / HTTP/1.1..\n00000010  48 6f 73 74 3a 20 6d 6f  63 6b 0d 0a 0d 0a        Host: mock....</pre><i>session ${pk[2]} on ${pk[1]}, base=${q.get('base')}</i></body></html>`) }
  if (p === '/arkime/api/sessions') {
    const rows = docs.slice(0, 500).map((d, i) => ({ id: `s${i}`, node: 'mock-sensor-1', node: 'mock-sensor-1', firstPacket: d.ts, lastPacket: d.ts + 1000, ipProtocol: d._source['network.transport'] === 'tcp' ? 6 : 17, source: { ip: d._source['source.ip'], port: d._source['source.port'] }, destination: { ip: d._source['destination.ip'], port: d._source['destination.port'] }, network: { packets: d._source['network.packets'], bytes: d._source['network.bytes'] } }))
    return send(res, { recordsTotal: rows.length, recordsFiltered: rows.length, data: page(new URLSearchParams({ start: q.get('start') ?? 0, length: q.get('length') ?? 50 }), rows) })
  }
  if (p === '/netbox/api/dcim/devices/') return send(res, nb(q, devices))
  if (p === '/netbox/api/ipam/ip-addresses/') return send(res, nb(q, ips))
  if (p === '/netbox/api/ipam/prefixes/') return send(res, nb(q, prefixes))
  if (p === '/netbox/api/dcim/sites/') return send(res, nb(q, sites))
  // Sensor kiosk (the Flask app's /update and /script_call routes)
  if (p === '/update') {
    return send(res, {
      cpu: { percent: 18 + Math.random() * 20 },
      ram: { percent: 52, total: 16 * 1024 ** 3, used: 8.3 * 1024 ** 3 },
      disks: [{ mount: '/', total: 500 * 1024 ** 3, used: 210 * 1024 ** 3, percent: 42 }, { mount: '/pcap', total: 2 * 1024 ** 4, used: 1.7 * 1024 ** 4, percent: 85 }],
      disk_io: { read_bytes_sec: 1.2e6, write_bytes_sec: 8.5e6 },
      net_io: { sent_bytes_sec: 2.4e5, received_bytes_sec: 4.1e7 },
      zeek: { conn: 12034, dns: 3401, http: 987 }, pcap: 214, suricata: 58,
    })
  }
  if (p.startsWith('/script_call/') && req.method === 'POST') {
    const cmd = decodeURIComponent(p.slice('/script_call/'.length))
    return send(res, { success: true, output: `mock sensor: "${cmd}" completed (nothing was changed)` })
  }
  if (p === '/dashboards/api/saved_objects/_find') {
    const type = q.get('type') ?? 'dashboard'
    const names = { dashboard: ['Overview', 'Security Overview', 'Connections', 'Files', 'Zeek Notices', 'Suricata Alerts'], visualization: ['HTTP - Status Overview', 'DNS - Top Queries', 'Connections - Sankey', 'Files - Types'], search: ['HTTP - Logs', 'DNS - Logs', 'Alerts - Logs'], 'index-pattern': ['arkime_sessions3-*', 'malcolm_beats_*', 'arkime_stats_*'] }[type] ?? []
    const all = Array.from({ length: type === 'visualization' ? 60 : names.length }, (_, i) => ({ type, id: `${type}-${i}`, updated_at: new Date(NOW - i * 3600000).toISOString(), attributes: { title: type === 'visualization' ? `${names[i % names.length]} ${i + 1}` : names[i], description: type === 'dashboard' || type === 'search' ? `Mock ${type} ${i + 1}` : undefined, visState: type === 'visualization' ? JSON.stringify({ type: choice(['table', 'pie', 'histogram', 'metric']) }) : undefined } }))
    const search = (q.get('search') ?? '').replace(/\*$/, '').toLowerCase()
    const hit = all.filter((o) => !search || o.attributes.title.toLowerCase().includes(search)).sort((a, b) => a.attributes.title.localeCompare(b.attributes.title))
    const per = Number(q.get('per_page') ?? 20), pg = Number(q.get('page') ?? 1)
    return send(res, { page: pg, per_page: per, total: hit.length, saved_objects: hit.slice((pg - 1) * per, pg * per) })
  }
  if (p === '/dashboards/api/console/proxy') {
    const path = q.get('path') ?? ''
    if (path.startsWith('_cat/indices')) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('health status index docs.count\ngreen  open   arkime_sessions3-260101 ' + N + '\n') }
    if (path.startsWith('_cluster/health')) return send(res, { cluster_name: 'mock', status: 'green', number_of_nodes: 1 })
    if (/_alerting\/monitors\/alerts/.test(path)) return send(res, { alerts: [], totalAlerts: 0 })
    if (/_alerting\/monitors\/[^/_?][^/?]*$/.test(path)) return send(res, { _id: 'm1', monitor: { name: 'Mock monitor', monitor_type: 'query_level_monitor', enabled: true, schedule: { period: { interval: 5, unit: 'MINUTES' } }, inputs: [{ search: { indices: ['arkime_sessions3-*'], query: { size: 0 } } }], triggers: [{ query_level_trigger: { name: 'Mock trigger', severity: '1', condition: { script: { source: 'ctx.results[0].hits.total.value > 0' } }, actions: [] } }] } })
    if (/_anomaly_detection\/detectors\/[^/_?][^/?]*$/.test(path)) return send(res, { _id: 'd1', anomaly_detector: { name: 'Mock detector', indices: ['arkime_sessions3-*'], time_field: 'firstPacket', detection_interval: { period: { interval: 10, unit: 'Minutes' } }, feature_attributes: [] } })
    if (/_notifications\/configs\/[^/?]+$/.test(path)) return send(res, { config_list: [{ config_id: 'c1', config: { name: 'Mock channel', config_type: 'slack', description: 'mock', is_enabled: true, feature_list: ['alerting'] } }] })
    if (path.includes('_alerting/monitors')) return send(res, { hits: { total: { value: 1 }, hits: [{ _id: 'm1', _source: { monitor: { name: 'Mock monitor', monitor_type: 'query_level_monitor', enabled: true, triggers: [{}] } } }] } })
    if (path.includes('_anomaly_detection')) return send(res, { hits: { total: { value: 0 }, hits: [] } })
    if (path.includes('_notifications')) return send(res, { config_list: [{ config_id: 'c1', config: { name: 'Mock channel', config_type: 'slack', is_enabled: true, description: 'mock' } }] })
    return send(res, { took: 1, hits: { total: { value: N }, hits: docs.slice(0, 3).map((d) => ({ _id: d._id, _source: d._source })) } })
  }
  if (p === '/dashboards/api/saved_objects/_bulk_get') return send(res, { saved_objects: [] })
  const so = /^\/dashboards\/api\/saved_objects\/(dashboard|visualization|search|index-pattern)\/(.+)$/.exec(p)
  if (so) {
    const [, type, id] = so
    const attributes = { title: `Mock ${type} ${id}`, description: 'Mock saved object' }
    if (type === 'dashboard') attributes.panelsJSON = JSON.stringify([{ panelIndex: '1', embeddableConfig: { title: 'Mock panel A' } }, { panelIndex: '2', embeddableConfig: {} }])
    if (type === 'visualization') attributes.visState = JSON.stringify({ type: 'table', aggs: [{ type: 'terms', schema: 'bucket', params: { field: 'network.protocol' } }] })
    if (type === 'search') Object.assign(attributes, { columns: ['source.ip', 'destination.ip'], sort: [['firstPacket', 'desc']], kibanaSavedObjectMeta: { searchSourceJSON: JSON.stringify({ query: { query: { query_string: { query: 'event.dataset:http' } } } }) } })
    if (type === 'index-pattern') Object.assign(attributes, { timeFieldName: 'firstPacket', fields: JSON.stringify([{ name: 'source.ip', type: 'ip', searchable: true, aggregatable: true }]) })
    return send(res, { id, type, updated_at: new Date(NOW).toISOString(), attributes, references: [] })
  }
  // Placeholder pages for the parts of Sampark SOC Tool that are not APIs, so the links in the UI land somewhere
  const STAND_INS = { '/mapi/': 'Sampark SOC Tool REST API', '/readme/': 'Sampark SOC Tool documentation', '/arkime/': 'Arkime', '/arkime/cyberchef.html': 'CyberChef', '/dashboards/': 'OpenSearch Dashboards', '/auth/': 'Authentication', '/upload/': 'Upload' }
  const standIn = STAND_INS[p] ?? (p.startsWith('/readme/') ? 'Sampark SOC Tool documentation' : p.startsWith('/dashboards/app/') ? 'OpenSearch Dashboards' : null)
  if (req.method === 'GET' && standIn) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end(`<!doctype html><html><head><title>${standIn} (mock)</title></head><body style="font-family:sans-serif;max-width:640px;margin:3rem auto"><h1>${standIn} (mock)</h1><p>Placeholder for <code>${p.replace(/[<>&]/g, '')}</code>. This page belongs to Sampark SOC Tool itself, which is not part of the mock.</p><p><a href="/ui/">Back to the UI</a></p></body></html>`)
  }
  // Stand-in for NetBox's own web pages, so "Open in NetBox" links show the same records the UI lists.
  if (req.method === 'GET' && p.startsWith('/netbox/') && !p.startsWith('/netbox/api/') && p !== '/netbox/login/') {
    const esc = (v) => String(v ?? '—').replace(/[<>&]/g, '')
    const label = (v) => (v && typeof v === 'object' ? v.label ?? v.name ?? v.display ?? v.address ?? v.model ?? v.value ?? JSON.stringify(v) : v)
    const MODELS = {
      'dcim/devices': ['Devices', devices], 'ipam/ip-addresses': ['IP addresses', ips], 'ipam/prefixes': ['Prefixes', prefixes], 'dcim/sites': ['Sites', sites],
    }
    const m = /^\/netbox\/((?:dcim|ipam)\/[a-z-]+)\/(?:(\d+)\/)?$/.exec(p)
    const shell = (title, body) => `<!doctype html><html><head><title>${esc(title)} | NetBox (mock)</title><style>body{font-family:sans-serif;margin:0}header{background:#2b3a4a;color:#fff;padding:.7rem 1.2rem}header a{color:#9ecbff;margin-right:1rem}main{max-width:900px;margin:1.5rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:.4rem .6rem;text-align:left}th{width:30%;color:#555}.note{color:#777;font-size:.85rem;margin-top:2rem}</style></head><body><header><b>NetBox</b> (mock) &nbsp; <a href="/netbox/dcim/devices/">Devices</a><a href="/netbox/ipam/ip-addresses/">IP addresses</a><a href="/netbox/ipam/prefixes/">Prefixes</a><a href="/netbox/dcim/sites/">Sites</a><a href="/ui/assets">Back to Assets</a></header><main>${body}<p class="note">Mock NetBox page. The real NetBox pages only exist when the UI runs against a real Sampark SOC Tool.</p></main></body></html>`
    res.writeHead(200, { 'Content-Type': 'text/html' })
    if (p === '/netbox/') return res.end(shell('Home', '<h1>NetBox</h1><p>Pick a section above.</p>'))
    if (m && MODELS[m[1]]) {
      const [title, list] = MODELS[m[1]]
      if (!m[2]) {
        const rows = list.map((o) => `<tr><td><a href="/netbox/${m[1]}/${o.id}/">${esc(o.name ?? o.address ?? o.prefix)}</a></td><td>${esc(label(o.status))}</td></tr>`).join('')
        return res.end(shell(title, `<h1>${title}</h1><table><tr><th>Name</th><th>Status</th></tr>${rows}</table>`))
      }
      const o = list.find((x) => String(x.id) === m[2])
      if (!o) return res.end(shell('Not found', '<h1>Not found</h1>'))
      const rows = Object.entries(o).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(label(v))}</td></tr>`).join('')
      return res.end(shell(esc(o.name ?? o.address ?? o.prefix), `<h1>${esc(o.name ?? o.address ?? o.prefix)}</h1><table>${rows}</table>`))
    }
    return res.end(shell('Page', `<h1>Mock NetBox</h1><p>No mock for <code>${esc(p)}</code>.</p>`))
  }
  if (p === '/netbox/login/') { res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'csrftoken=mocktoken123; Path=/' }); return res.end('<html><body>login</body></html>') }
  const lst = /^\/netbox\/api\/(dcim\/devices|ipam\/ip-addresses|ipam\/prefixes|dcim\/sites)\/$/.exec(p)
  if (lst && req.method === 'OPTIONS') {
    const choices = ['active', 'planned', 'offline', 'staged', 'decommissioning'].map((v) => ({ value: v, display_name: v[0].toUpperCase() + v.slice(1) }))
    return send(res, { actions: { POST: { status: { type: 'choice', choices }, description: { type: 'string' } } } })
  }
  const det = /^\/netbox\/api\/(dcim\/devices|ipam\/ip-addresses|ipam\/prefixes|dcim\/sites)\/(\d+)\/$/.exec(p)
  if (det && (req.method === 'PATCH' || req.method === 'DELETE')) {
    if (req.headers['x-csrftoken'] !== 'mocktoken123') return send(res, { detail: 'CSRF Failed: CSRF token missing or incorrect.' }, 403)
    const l = { 'dcim/devices': devices, 'ipam/ip-addresses': ips, 'ipam/prefixes': prefixes, 'dcim/sites': sites }[det[1]]
    const i = l.findIndex((x) => String(x.id) === det[2])
    if (i < 0) return send(res, { detail: 'Not found.' }, 404)
    if (req.method === 'DELETE') { l.splice(i, 1); res.writeHead(204); return res.end() }
    return readBody(req).then((b) => {
      if (typeof b.name === 'string' && !b.name.trim()) return send(res, { name: ['This field may not be blank.'] }, 400)
      if ('status' in b && !['active', 'planned', 'offline', 'staged', 'decommissioning'].includes(b.status)) return send(res, { status: [`"${b.status}" is not a valid choice.`] }, 400)
      for (const [k, v] of Object.entries(b)) l[i][k] = k === 'status' ? { value: v, label: String(v)[0].toUpperCase() + String(v).slice(1) } : v
      send(res, l[i])
    })
  }
  if (det) {
    const list = { 'dcim/devices': devices, 'ipam/ip-addresses': ips, 'ipam/prefixes': prefixes, 'dcim/sites': sites }[det[1]]
    const o = list.find((x) => String(x.id) === det[2])
    return o ? send(res, { ...o, display: o.name ?? o.address ?? o.prefix, url: p, created: '2026-01-01' }) : send(res, { detail: 'Not found.' }, 404)
  }
  if (p.startsWith('/extracted-files')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html><body><pre><a href="../">../</a>\n<a href="quarantine/">quarantine/</a>\n<a href="report.pdf">report.pdf</a>\n</pre></body></html>') }
  if (p.startsWith('/upload/server')) { req.resume(); return req.on('end', () => send(res, { ok: true })) }
  send(res, { error: 'not mocked', path: p }, 404)
})
server.listen(8081, () => console.log('Mock Sampark SOC Tool backend on http://localhost:8081'))
