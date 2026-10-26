import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, closeSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { readStore, readJson, localPath, atomicJson, inputDigest, writeManifest, beginReview, resolveReview, ReviewError } from './review/core.mjs'

const args = process.argv.slice(2), command = args[0] || 'start'
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const root = resolve(option('--root') || resolve(dirname(fileURLToPath(import.meta.url)), '..'))
function readingPath() {
  const catalog = readJson(resolve(root, 'content/chapters.json'))
  const chapter = catalog.find(c => c.id === '03' && c.status === 'published') || catalog.find(c => c.status === 'published')
  return chapter ? `/hello-hermes/${chapter.path || `chapters/${chapter.slug}`}.html` : '/hello-hermes/preface.html'
}
function run(script) {
  const result = spawnSync(process.execPath, ['--run', script], { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.error || result.status !== 0) throw new ReviewError(`${script} 检查失败，未记录为通过。`)
}
function build() {
  const before = inputDigest(root); run('docs:build')
  if (inputDigest(root) !== before) throw new ReviewError('构建期间正文发生变化，请重新构建。')
  return writeManifest(root)
}
async function status() {
  try {
    const s = readJson(localPath(root, 'session.json')), response = await fetch(s.origin + '/__review/health', { signal: AbortSignal.timeout(1500) }), health = await response.json()
    return health.instanceId === s.instanceId && health.projectId === s.projectId && health.service === 'hello-hermes-review' ? s : null
  } catch { return null }
}
async function main() {
  if (command === 'build') { build(); return console.log('本地审阅页面已更新；已打开的页面请刷新。') }
  if (command === 'status') { const s = await status(); return console.log(s ? `${s.origin}${readingPath()}` : '本地审阅后台未运行。') }
  if (command === 'stop') {
    const s = await status(); if (!s) return console.log('没有正在运行的本项目后台。')
    const res = await fetch(s.origin + '/__review/api/shutdown', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': s.token }, body: '{}' })
    if (!res.ok) throw new ReviewError('未能停止匹配的后台。')
    return console.log('本地审阅后台已停止，批注仍保留。')
  }
  if (command === 'start') {
    const old = await status(); if (old) return console.log(`已在运行：${old.origin}${readingPath()}`)
    mkdirSync(localPath(root), { recursive: true })
    let lock
    try { lock = openSync(localPath(root, 'start.lock'), 'wx'); writeFileSync(lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })) } catch { throw new ReviewError('后台正在启动；请稍后查询 status。若启动进程异常退出，请检查 .review/start.lock。') }
    try {
      build()
      let preferred = Number(option('--port') || 0)
      if (!option('--port') && existsSync(localPath(root, 'last-port.json'))) preferred = readJson(localPath(root, 'last-port.json')).port
      if (!Number.isInteger(preferred) || preferred < 0 || preferred > 65535) throw new ReviewError('端口必须是 0 到 65535 的整数。')
      async function launch(port) {
        const id = randomUUID(), log = openSync(localPath(root, 'server.log'), 'a')
        const child = spawn(process.execPath, [resolve(root, 'scripts/review/server.mjs'), '--root', root, '--port', String(port), '--instance', id], { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] })
        closeSync(log); child.unref()
        let exited = false, spawnError
        child.once('exit', () => { exited = true }); child.once('error', error => { spawnError = error })
        for (let i = 0; i < 60; i++) {
          const s = await status()
          if (s?.instanceId === id) return s
          if (spawnError) throw spawnError
          if (exited) return null
          await new Promise(done => setTimeout(done, 150))
        }
        return null
      }
      let running = await launch(preferred)
      // A remembered port may belong to another app. Choose a free port without stopping it.
      if (!running && preferred && !option('--port')) running = await launch(0)
      if (!running) throw new ReviewError('后台未能启动，请查看 .review/server.log；未停止其他服务。')
      atomicJson(localPath(root, 'last-port.json'), { port: running.port })
      return console.log(`本地审阅：${running.origin}${readingPath()}\n选中文字添加批注；批注保存在 .review/annotations.json。`)
    } finally { if (lock !== undefined) { closeSync(lock); unlinkSync(localPath(root, 'start.lock')) } }
  }
  if (command === 'list') {
    const store = readStore(root), annotations = store.annotations.filter(a => args.includes('--all') || a.status === 'open')
    return console.log(JSON.stringify({ projectId: store.projectId, pending: store.annotations.filter(a => a.status === 'open').length, annotations }, null, 2))
  }
  if (command === 'begin') { const result = beginReview(root); return console.log(JSON.stringify({ batch: result.path, targets: result.batch.targets.length }, null, 2)) }
  if (command === 'validate') {
    const batchPath = resolve(option('--batch') || ''), rel = relative(localPath(root, 'batches'), batchPath)
    if (!existsSync(batchPath) || rel.startsWith('..') || isAbsolute(rel)) throw new ReviewError('请指定本项目 begin 创建的 --batch 路径。')
    run('test'); const manifest = build()
    atomicJson(resolve(dirname(batchPath), 'validation.json'), { passed: true, at: new Date().toISOString(), inputDigest: manifest.inputDigest, checks: ['test', 'docs:build'] })
    return console.log('验证已绑定当前正文；完成必要的图文与浏览器核对后再 resolve。')
  }
  if (command === 'resolve') { if (!option('--batch')) throw new ReviewError('缺少 --batch。'); return console.log(JSON.stringify(resolveReview(root, resolve(option('--batch'))), null, 2)) }
  if (['help', '--help', '-h'].includes(command)) return console.log('node scripts/review.mjs start|status|stop|build|list [--all]|begin|validate --batch PATH|resolve --batch PATH\n本地批注不调用模型、不进入公共站点。按批注改稿：list → begin → 编辑正文与 decisions → validate → 图文检查 → resolve。')
  throw new ReviewError('未知命令。运行 node scripts/review.mjs help 查看帮助。')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
