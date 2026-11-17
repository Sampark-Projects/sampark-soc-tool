// Starts the mock backend and the Vite dev server pointed at it.
import './server.mjs'
process.env.BACKEND = 'http://localhost:8081'
const { createServer } = await import('vite')
const s = await createServer()
await s.listen()
s.printUrls()
