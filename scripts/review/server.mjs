import { createServer } from 'node:http'
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, existsSync, statSync, realpathSync, unlinkSync } from 'node:fs'
import { resolve, dirname, extname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomicJson, ensureStore, readStore, mutate, getPage, localPath, ReviewError } from './core.mjs'

const runtime = dirname(fileURLToPath(import.meta.url))
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': mime['.json'] }); res.end(JSON.stringify(value)) }
async function body(req) {
  let size = 0, chunks = []
  for await (const chunk of req) { size += chunk.length; if (size <= 65536) chunks.push(chunk) }
  if (size > 65536) throw new ReviewError('批注内容过大。', 413)
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ReviewError('无法读取批注内容，请重试。') }
}
export async function createReviewServer({ root, port = 0, instanceId = randomUUID(), register = false }) {
  root = resolve(root)
  const store = ensureStore(root), token = randomBytes(32).toString('hex'), dist = resolve(root, 'docs/.vitepress/dist')
  if (!existsSync(dist) || !existsSync(localPath(root, 'build.json'))) throw new ReviewError('请先运行 node scripts/review.mjs build。')
  let origin
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer')
    try {
      if (req.headers.host !== origin.slice(7)) throw new ReviewError('仅允许本机审阅地址。', 403)
      if (req.headers.origin && req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') throw new ReviewError('不允许跨站访问。', 403)
      const url = new URL(req.url, origin)
      let path
      try { path = decodeURIComponent(url.pathname) } catch { throw new ReviewError('无效的页面地址。') }
      if (path === '/__review/health' && req.method === 'GET') return json(res, 200, { service: 'hello-hermes-review', projectId: store.projectId, instanceId })
      if (path === '/__review/session' && req.method === 'GET') return json(res, 200, { token, projectId: store.projectId })
      if (path.startsWith('/__review/api/')) {
        const supplied = Buffer.from(String(req.headers['x-review-token'] || '')), expected = Buffer.from(token)
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ReviewError('本地会话已失效，请刷新页面。', 403)
        if (req.method === 'GET' && path === '/__review/api/page') return json(res, 200, getPage(root, url.searchParams.get('path') || ''))
        if (req.method === 'GET' && path === '/__review/api/annotations') return json(res, 200, readStore(root))
        if (req.method === 'POST') {
          if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ReviewError('请求必须使用 JSON。', 415)
          if (path === '/__review/api/annotations') return json(res, 200, mutate(root, await body(req)))
          if (path === '/__review/api/shutdown') {
            await body(req); json(res, 200, { stopped: true }); server.close(); server.closeIdleConnections(); return
          }
        }
        throw new ReviewError('未找到审阅操作。', 404)
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new ReviewError('不支持这个请求。', 405)
      const assets = { '/__review/client.mjs': 'client.mjs', '/__review/style.css': 'style.css', '/__review/anchors.mjs': 'anchors.mjs' }
      let file
      if (assets[path]) file = resolve(runtime, assets[path])
      else {
        if (path === '/') { res.writeHead(302, { Location: '/hello-hermes/chapters/03-agent-loop.html' }); return res.end() }
        if (!path.startsWith('/hello-hermes/') || path.includes('\0') || path.includes('\\')) throw new ReviewError('未找到页面。', 404)
        file = resolve(dist, path.slice('/hello-hermes/'.length) || 'index.html')
        if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html')
        if (!existsSync(file) || !statSync(file).isFile()) throw new ReviewError('未找到页面。', 404)
        const rel = relative(realpathSync(dist), realpathSync(file))
        if (rel.startsWith('..' + sep) || rel === '..' || !mime[extname(file)]) throw new ReviewError('未找到页面。', 404)
      }
      let content = readFileSync(file)
      if (extname(file) === '.html') {
        let version = ''
        try { const page = getPage(root, path); version = `<meta name="hello-hermes-review-version" content="${page.revision}" data-page="${encodeURIComponent(page.id)}">` } catch {}
        content = Buffer.from(content.toString('utf8').replace('</head>', version + '<link rel="stylesheet" href="/__review/style.css"></head>').replace('</body>', '<script type="module" src="/__review/client.mjs"></script></body>'))
      }
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': content.length })
      res.end(req.method === 'HEAD' ? undefined : content)
    } catch (error) {
      if (res.headersSent) return res.destroy()
      if (!error.status) console.error(error.stack || error.message)
      json(res, error.status || 500, { error: error.status ? error.message : '本地保存失败，原批注文件未被替换；请检查后台日志。' })
    }
  })
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxHeadersCount = 40
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done) })
  origin = `http://127.0.0.1:${server.address().port}`
  const session = { pid: process.pid, port: server.address().port, origin, instanceId, projectId: store.projectId, token }
  if (register) {
    atomicJson(localPath(root, 'session.json'), session)
    server.on('close', () => {
      try { const current = JSON.parse(readFileSync(localPath(root, 'session.json'), 'utf8')); if (current.instanceId === instanceId) unlinkSync(localPath(root, 'session.json')) } catch {}
    })
  }
  return { server, ...session }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1]
  try {
    const running = await createReviewServer({ root: arg('--root'), port: Number(arg('--port') || 0), instanceId: arg('--instance'), register: true })
    console.log(`Local review listening: ${running.origin}`)
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { running.server.close(); running.server.closeAllConnections() })
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
