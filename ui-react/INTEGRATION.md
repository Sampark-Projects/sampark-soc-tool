# Serving the React UI from the existing nginx container

The React app is built with `base: '/ui/'`, so it is reachable at `https://<host>/ui/`
and does not clash with the existing `/upload/`, `/auth/`, `/netbox/` routes. The old
landing page stays at `/` until you decide to switch.

## 1. Build stage (add to `Dockerfiles/nginx.Dockerfile`, near the top)

```dockerfile
FROM node:22-alpine AS uibuild
WORKDIR /ui
COPY ui-react/package*.json ./
RUN npm ci || npm install
COPY ui-react/ ./
RUN npm run build
```

## 2. Copy the build (next to `ADD nginx/landingpage /usr/share/nginx/html`)

```dockerfile
COPY --from=uibuild /ui/dist /usr/share/nginx/html/ui
```

## 3. Runtime config (replaces the old `*_REPLACER` sed step)

In `nginx/scripts/docker_entrypoint.sh`, right after the `for HTML in ...; done` loop
(it already computes `AUTH_*`, `NETBOX_*`, `MALCOLM_DASHBOARDS_*`), add:

```bash
  jq -n \
    --arg version "v${MALCOLM_VERSION:-unknown}" \
    --arg dashboardsUrl "${MALCOLM_DASHBOARDS_URL}" --arg dashboardsName "${MALCOLM_DASHBOARDS_NAME}" \
    --arg dashboardsIcon "${MALCOLM_DASHBOARDS_ICON}" \
    --arg netboxUrl "${NETBOX_LINK}" --arg netboxTitle "${NETBOX_TITLE}" --arg netboxDesc "${NETBOX_DESC}" \
    --arg authUrl "${AUTH_LINK}" --arg authTitle "${AUTH_TITLE}" --arg authDesc "${AUTH_DESC}" \
    '$ARGS.named' > /usr/share/nginx/html/ui/config.json || true
```
(Check `jq` exists in the image; if not, add it to the apk install list.)

## 4. nginx: SPA fallback for deep links

Inside the server block that serves `/usr/share/nginx/html`, add:

```nginx
location /ui/ {
    try_files $uri $uri/ /ui/index.html;
}
```

## 5. Notes
- **Upload** posts to the existing `/upload/server/php/submit.php`; PHP/nginx size limits are unchanged
  (a single multi-file POST replaces FilePond's per-file transfer, so check `client_max_body_size`
  and `upload_max_filesize` if you upload very large PCAPs).
- **Accounts** links into the existing htadmin app under `authUrl`.
- **Kiosk** only works where the kiosk Flask app is reachable. For the sensor kiosk machine, build
  with `VITE_KIOSK_API=<prefix>` (default: same origin) and serve `dist/` alongside the Flask app.

## Local development
```
npm install
npm run dev      # http://localhost:5173/ui/  (proxies /mapi, /upload/server, /auth to https://localhost)
npm run build
```
