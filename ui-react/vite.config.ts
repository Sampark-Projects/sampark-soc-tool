import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const NAME = 'Sampark SOC Tool'

// Dev only: the OpenSearch Dashboards app lives on the backend and brands itself "Malcolm". While developing through
// this proxy we rewrite its page and JSON answers so it shows the Sampark name and logo straight away. (On a real
// deployment the same branding comes from dashboards/opensearch_dashboards.yml.)
function rebrand(body: string): string {
  return body
    .replace(/Malcolm_outline_banner_dark\.png/g, 'Sampark_logo.png')
    .replace(/(img(?:\/|&#x2F;))(?:icon_dark|icon|favicon32)\.png/g, '$1Sampark_mark.png')
    .replace(/Malcolm/g, NAME)
}

// Serves the two Sampark images at /assets/img/ (where the dashboards expect their logos) from ./public
const samparkImages = {
  name: 'sampark-images',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const m = /^\/assets\/img\/(Sampark_(?:logo|mark)\.png)$/.exec((req.url ?? '').split('?')[0])
      if (!m) return next()
      res.setHeader('Content-Type', 'image/png')
      res.end(fs.readFileSync(path.resolve(__dirname, 'public', m[1])))
    })
  },
}

const target = process.env.BACKEND ?? 'https://localhost'
const base = { target, secure: false, changeOrigin: true, ...(process.env.BACKEND_AUTH ? { auth: process.env.BACKEND_AUTH } : {}) }

const dashboardsProxy = {
  ...base,
  selfHandleResponse: true,
  configure: (proxy: any) => {
    proxy.on('proxyReq', (proxyReq: any) => proxyReq.setHeader('accept-encoding', 'identity'))
    proxy.on('proxyRes', (proxyRes: any, _req: any, res: any) => {
      const headers = { ...proxyRes.headers }
      const type = String(headers['content-type'] ?? '')
      if (!/text\/html|application\/json/.test(type)) {
        res.writeHead(proxyRes.statusCode ?? 200, headers)
        proxyRes.pipe(res)
        return
      }
      const chunks: Buffer[] = []
      proxyRes.on('data', (c: Buffer) => chunks.push(c))
      proxyRes.on('end', () => {
        const out = Buffer.from(rebrand(Buffer.concat(chunks).toString('utf8')), 'utf8')
        headers['content-length'] = String(out.length)
        res.writeHead(proxyRes.statusCode ?? 200, headers)
        res.end(out)
      })
    })
  },
}

// Dev only: Arkime's pages get the Sampark stylesheet/script added (see public/arkime-theme.css). Everything else passes through.
const arkimeProxy = {
  ...base,
  selfHandleResponse: true,
  configure: (proxy: any) => {
    proxy.on('proxyReq', (proxyReq: any) => proxyReq.setHeader('accept-encoding', 'identity'))
    proxy.on('proxyRes', (proxyRes: any, _req: any, res: any) => {
      const headers = { ...proxyRes.headers }
      if (!/text\/html/.test(String(headers['content-type'] ?? ''))) {
        res.writeHead(proxyRes.statusCode ?? 200, headers)
        proxyRes.pipe(res)
        return
      }
      const chunks: Buffer[] = []
      proxyRes.on('data', (c: Buffer) => chunks.push(c))
      proxyRes.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8').replace(
          '</head>',
          '<link rel="stylesheet" href="/ui/arkime-theme.css?v=3"><script src="/ui/arkime-theme.js?v=3"></script></head>',
        )
        const out = Buffer.from(html, 'utf8')
        headers['content-length'] = String(out.length)
        res.writeHead(proxyRes.statusCode ?? 200, headers)
        res.end(out)
      })
    })
  },
}

export default defineConfig({
  plugins: [react(), samparkImages],
  base: '/ui/',
  server: {
    port: 5173,
    // Point at a running Sampark SOC Tool nginx when developing locally. BACKEND_AUTH=user:password (optional) adds
    // HTTP Basic auth to every proxied request, so no browser login prompt is needed.
    proxy: {
      ...Object.fromEntries(
        ['/mapi', '/upload', '/auth', '/netbox', '/extracted-files', '/readme', '/update', '/script_call'].map((p) => [p, base]),
      ),
      '/arkime': arkimeProxy,
      '/dashboards': dashboardsProxy,
    },
  },
  build: { outDir: 'dist' },
})
