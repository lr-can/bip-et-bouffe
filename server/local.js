/**
 * Serveur local optionnel (sans Netlify CLI).
 * Préférer `npm run dev` avec @netlify/vite-plugin.
 */
import 'dotenv/config'
import http from 'node:http'
import { handleApi } from './handleApi.js'

const PORT = Number(process.env.API_PORT || 3001)

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`
    const url = `http://${host}${req.url}`
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)

    const hasBody = !['GET', 'HEAD'].includes(req.method || '') && body.length > 0
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(hasBody ? { body, duplex: 'half' } : {}),
    })

    const response = await handleApi(request)
    const text = await response.text()
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(text)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`Cooking API (local) → http://localhost:${PORT}`)
})
