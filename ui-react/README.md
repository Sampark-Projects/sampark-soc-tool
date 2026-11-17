# Sampark SOC Tool — React UI

React 18 + TypeScript + Vite replacement for the Sampark SOC Tool web UI pieces served by nginx.
Served at `/ui/` (the original landing page at `/` is untouched).

## Run

```
npm install
npm run dev:mock    # fake backend on :8081 + Vite (no Docker needed) — or double-click start-mock.bat
npm run dev         # Vite only, proxies /mapi, /arkime, /netbox, ... to https://localhost (a real Sampark SOC Tool)
npm run build       # type-check + production build into dist/
```

`BACKEND=http://host:port npm run dev` points the proxy somewhere else.
If port 5173 is busy Vite picks 5174; check the URL it prints.

## Pages (all under `/ui/`)

| Route | What it does | Data source |
|---|---|---|
| `/` | Landing tiles | `config.json` |
| `/dashboards`, `/dashboards/:slug` | 89 dashboards rebuilt from the OpenSearch Dashboards saved objects (metrics, time charts, top-N lists, logs table) | `/mapi/agg`, `/mapi/document` |
| `/explorer` | Discover-style: field list, filters, event table | `/mapi/fields`, `agg`, `document` |
| `/spiview` | Top values for many fields at once | `/mapi/agg` |
| `/connections` | Node/edge graph for a pair of fields | `/mapi/agg/<a>,<b>` |
| `/sessions` | Arkime session list with packet view | `/arkime/api/sessions`, `/arkime/api/session/<node>/<id>/packets` |
| `/hunts` | Arkime hunts: list, create, pause/resume, delete | `/arkime/api/hunts`, `/arkime/api/hunt` |
| `/settings` | Arkime display preferences | `/arkime/api/user/settings` |
| `/statistics` | Arkime capture-node stats | `/arkime/api/stats` |
| `/assets`, `/assets/:kind/:id` | NetBox lists, detail, edit of simple fields, delete | `/netbox/api/...` |
| `/files` | Extracted files browser | `/extracted-files/` |
| `/upload` | PCAP upload | `/upload/server/php/submit.php` |
| `/accounts` | Links to the existing htadmin (local accounts) or the auth page for LDAP/Keycloak | — |
| `/kiosk` | Sensor kiosk controls | kiosk Flask app |
| `/status` | Service readiness, version, ingest, indices | `/mapi/ready`, `version`, `ingest-stats`, `indices` |

## Known limits (be honest about these)

- **Run against one real Sampark SOC Tool (26.10.0, read-only) on 2026-11-16.** All pages loaded and the `/mapi`, Arkime and Status data matched the shapes the UI expects. 85 of 90 dashboards loaded cleanly. On that server (a) NetBox was not running, so Assets returned 404 and NetBox edit/delete are untested against a real NetBox, and (b) aggregations on `network.type` and `threat.indicator.type` returned HTTP 500, so panels using them (threat-intelligence, severity, asset-interaction-analysis, zeek-known-summary) show "Server error for this panel"; cause not established. `file-scanning` showed one failing panel once, cause unknown. Not yet built or served through the nginx image.
- The Sampark SOC Tool API has only `count` aggregations, so panels that sum or take maxima (bytes, duration) show document counts instead; region maps render as country lists.
- 9 of the 89 saved-search queries could not be fully translated into API filters (flagged in `src/data/dashboards.json`, `ok: false`).
- Custom visualizations are rebuilt as approximations from the original definitions: Sankey flows (5), connection trees (4), input controls (13, shown as dropdowns), tile/region maps (17, shown as country lists by document count), ICS "Trends" charts (3, shown as destination/action summaries) and 2 histograms (shown as top values). "File Tree" is rebuilt as an expandable tree of the 500 most recent Strelka files; "Biomes" is rebuilt as a Purdue-zone flow plus a zone -> host tree rather than the original IP-level graph.
- Writes (Arkime hunts and settings, NetBox edit/delete, PCAP upload) were only tested against the mock; none were tried on the real server. Real Arkime may demand its anti-CSRF token and real NetBox needs a user with edit permission; the pages show the server's message and a link to the original app when a write is refused.
- Deliberately not rebuilt (the original app stays in use): Arkime full packet/session explorer, creating NetBox objects that need related-object pickers, htadmin (third-party PHP app that edits the htpasswd file), OpenSearch plugin screens (linked from the home page), CyberChef, Documentation.
- `npm run build` type-checks with `tsc`; it was checked only against stub React types here, so run it once locally.

## Deployment

Already wired into the repo (uncommitted local changes): `Dockerfiles/nginx.Dockerfile` (build stage + copy),
`nginx/scripts/docker_entrypoint.sh` (writes `ui/config.json`), `nginx/nginx.conf` and `nginx/nginx_readonly.conf`
(`/ui/` SPA fallback), `.dockerignore`. See `INTEGRATION.md`.
