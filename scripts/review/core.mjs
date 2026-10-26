import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync, readdirSync, copyFileSync } from 'node:fs'
import { resolve, relative, dirname, sep } from 'node:path'

export const hash = value => createHash('sha256').update(value).digest('hex')
export const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
export const localPath = (root, path = '') => resolve(root, '.review', path)
export class ReviewError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
export function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`
  let fd
  try {
    fd = openSync(temp, 'wx', 0o600)
    writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); closeSync(fd); fd = undefined
    renameSync(temp, path)
  } finally { if (fd !== undefined) closeSync(fd); if (existsSync(temp)) unlinkSync(temp) }
}
function locked(root, callback) {
  mkdirSync(localPath(root), { recursive: true })
  const lock = localPath(root, 'data.lock')
  let fd
  try { fd = openSync(lock, 'wx', 0o600) } catch { throw new ReviewError('批注文件正在被另一项操作使用；请稍后重试。若进程已异常退出，请先检查 .review/data.lock。', 409) }
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); return callback() }
  finally { closeSync(fd); unlinkSync(lock) }
}
export function ensureStore(root) {
  const path = localPath(root, 'annotations.json')
  if (!existsSync(path)) locked(root, () => {
    if (!existsSync(path)) atomicJson(path, { schemaVersion: 1, projectId: randomUUID(), annotations: [], operations: [] })
  })
  return readJson(path)
}
export const readStore = root => ensureStore(root)
const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item)
const idPattern = /^[a-zA-Z0-9_-]{8,100}$/
const required = (v, max, label) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ReviewError(`${label}不能为空，且长度不能超过 ${max} 字符。`); return v.trim() }
function pageRevision(root, source) {
  const figures = [...new Set([...source.matchAll(/src="(\/images\/[^"<>]+)"/g)].map(m => m[1]))]
  return hash(hash(source) + '\n' + figures.map(src => {
    const file = resolve(root, 'docs/public' + src)
    if (src.includes('..') || !existsSync(file)) return `${src}:missing`
    return `${src}:${hash(readFileSync(file))}`
  }).join('\n'))
}
export function pageCatalog(root) {
  const catalog = readJson(resolve(root, 'content/chapters.json'))
  const unpublished = new Set(catalog.filter(c => c.status !== 'published').map(c => `${c.path || `chapters/${c.slug}`}.md`))
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.name.startsWith('.') || e.name === 'public' ? [] : e.isDirectory() ? walk(resolve(dir, e.name)) : e.name.endsWith('.md') ? [resolve(dir, e.name)] : [])
  return walk(resolve(root, 'docs')).filter(file => !unpublished.has(relative(resolve(root, 'docs'), file).split(sep).join('/'))).map(file => {
    const source = readFileSync(file, 'utf8'), sourcePath = relative(root, file).split(sep).join('/'), id = sourcePath.slice(5, -3)
    return { id, sourcePath, title: source.match(/^title:\s*(.+)$/m)?.[1] || source.match(/^# (.+)$/m)?.[1] || id, revision: pageRevision(root, source), url: `/hello-hermes/${id === 'index' ? '' : id + '.html'}` }
  })
}
export function inputDigest(root) {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => ['dist', 'cache'].includes(e.name) ? [] : e.isSymbolicLink() ? [] : e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)])
  const files = [...walk(resolve(root, 'docs')), ...walk(resolve(root, 'content')), resolve(root, 'editorial/figures.json'), resolve(root, 'package.json')].filter(existsSync)
  return hash(files.map(file => `${relative(root, file)}\0${hash(readFileSync(file))}`).join('\n'))
}
export function writeManifest(root) {
  const manifest = { createdAt: new Date().toISOString(), inputDigest: inputDigest(root), pages: pageCatalog(root) }
  atomicJson(localPath(root, 'build.json'), manifest); return manifest
}
export function getPage(root, pathname) {
  const manifest = readJson(localPath(root, 'build.json'))
  const path = pathname.replace(/\/$/, '/index.html')
  const page = manifest.pages.find(p => p.url === pathname || `/hello-hermes/${p.id}.html` === path)
  if (!page) throw new ReviewError('当前页面没有可批注的 Markdown 正文。', 404)
  return { ...page, stale: !existsSync(resolve(root, page.sourcePath)) || pageRevision(root, readFileSync(resolve(root, page.sourcePath), 'utf8')) !== page.revision }
}
function validateAnchor(anchor, page) {
  if (!anchor || anchor.revision !== page.revision || page.stale) throw new ReviewError('正文版本已变化，请重新构建并刷新页面后再定位；当前意见已保留为草稿。', 409)
  if (!['text', 'figure'].includes(anchor.kind)) throw new ReviewError('无效的批注类型。')
  const result = { kind: anchor.kind, revision: anchor.revision, sectionId: String(anchor.sectionId || '').slice(0, 300), section: String(anchor.section || '').slice(0, 300), quote: required(anchor.quote, 6000, '原文') }
  if (anchor.kind === 'text') {
    if (!Number.isInteger(anchor.start) || !Number.isInteger(anchor.end) || anchor.start < 0 || anchor.end <= anchor.start) throw new ReviewError('无效的原文范围。')
    Object.assign(result, { start: anchor.start, end: anchor.end, prefix: String(anchor.prefix || '').slice(-80), suffix: String(anchor.suffix || '').slice(0, 80), blockText: String(anchor.blockText || '').slice(0, 6000) })
  } else {
    if (typeof anchor.src !== 'string' || !anchor.src.startsWith('/hello-hermes/images/') || anchor.src.includes('..')) throw new ReviewError('无效的图片位置。')
    result.src = anchor.src
  }
  return result
}
export function mutate(root, operation, pageResolver = url => getPage(root, url)) {
  if (!operation || !idPattern.test(operation.operationId || '')) throw new ReviewError('缺少有效的操作编号。')
  ensureStore(root)
  return locked(root, () => {
    const path = localPath(root, 'annotations.json'), store = readJson(path), fingerprint = hash(canonical(operation))
    const previous = store.operations.find(o => o.id === operation.operationId)
    if (previous) { if (previous.fingerprint !== fingerprint) throw new ReviewError('同一操作编号不能用于不同内容。', 409); return previous.result }
    const now = new Date().toISOString()
    let item
    if (operation.action === 'add') {
      const page = pageResolver(operation.pageUrl)
      if (!idPattern.test(operation.id || '') || store.annotations.some(a => a.id === operation.id)) throw new ReviewError('批注编号已存在或无效。', 409)
      item = { id: operation.id, pageId: page.id, pageUrl: page.url, title: page.title, sourcePath: page.sourcePath, comment: required(operation.comment, 8000, '批注意见'), anchor: validateAnchor(operation.anchor, page), version: 1, status: 'open', createdAt: now, updatedAt: now, history: [] }
      store.annotations.push(item)
    } else if (['update', 'delete', 'reopen'].includes(operation.action)) {
      item = store.annotations.find(a => a.id === operation.id)
      if (!item || item.version !== operation.expectedVersion) throw new ReviewError('批注已被修改，请刷新列表；不会覆盖较新的意见。', 409)
      if (item.status === 'deleted') throw new ReviewError('这条批注已删除。', 409)
      if (operation.action === 'update') { item.comment = required(operation.comment, 8000, '批注意见'); item.status = 'open'; delete item.resolution }
      if (operation.action === 'delete') item.status = 'deleted'
      if (operation.action === 'reopen') { item.status = 'open'; delete item.resolution }
      item.version++; item.updatedAt = now
    } else throw new ReviewError('不支持的批注操作。')
    item.history.push({ action: operation.action, version: item.version, at: now, comment: item.comment, status: item.status })
    const result = { id: item.id, version: item.version, status: item.status }
    store.operations.push({ id: operation.operationId, fingerprint, result })
    store.operations = store.operations.slice(-2000)
    atomicJson(path, store)
    return result
  })
}
export function beginReview(root) {
  const store = readStore(root), targets = store.annotations.filter(a => a.status === 'open').map(a => structuredClone(a))
  if (!targets.length) throw new ReviewError('目前没有待处理批注。')
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`, folder = localPath(root, `batches/${id}`)
  mkdirSync(resolve(folder, 'snapshot'), { recursive: true })
  const allowed = new Set(pageCatalog(root).map(p => p.sourcePath)), files = new Set(['content/verification.json', 'editorial/figures.json'])
  for (const target of targets) {
    if (!allowed.has(target.sourcePath)) throw new ReviewError('批注指向的章节已移除，请先核对目录。', 409)
    files.add(target.sourcePath)
    const source = readFileSync(resolve(root, target.sourcePath), 'utf8')
    for (const [, image] of source.matchAll(/src="(\/images\/[^"<>]+)"/g)) {
      if (image.includes('..')) throw new ReviewError('图解路径超出正文范围。')
      files.add(`docs/public${image}`)
    }
  }
  const snapshots = []
  for (const file of files) {
    if (!existsSync(resolve(root, file))) continue
    const to = resolve(folder, 'snapshot', file); mkdirSync(dirname(to), { recursive: true }); copyFileSync(resolve(root, file), to)
    snapshots.push({ file, hash: hash(readFileSync(to)) })
  }
  const batch = { schemaVersion: 1, id, projectId: store.projectId, createdAt: new Date().toISOString(), targets, snapshots, decisions: targets.map(a => ({ id: a.id, outcome: 'blocked', summary: '', evidence: [] })) }
  const path = resolve(folder, 'batch.json'); atomicJson(path, batch)
  // Immutable frozen targets are separate from the agent-editable decisions file.
  atomicJson(resolve(folder, 'targets.json'), { projectId: store.projectId, targets })
  return { path, batch }
}
export function resolveReview(root, path) {
  const folder = dirname(resolve(path)), rel = relative(localPath(root, 'batches'), folder)
  if (!rel || rel.startsWith('..') || rel.includes(sep + '..')) throw new ReviewError('批次必须位于本项目 .review/batches/ 内。')
  const batch = readJson(path), frozen = readJson(resolve(folder, 'targets.json')), receiptPath = resolve(folder, 'validation.json')
  if (!existsSync(receiptPath) || readJson(receiptPath).inputDigest !== inputDigest(root) || !readJson(receiptPath).passed) throw new ReviewError('请先对当前正文运行 validate --batch；改稿后旧验证不能核销批注。', 409)
  if (batch.projectId !== frozen.projectId || canonical(batch.targets) !== canonical(frozen.targets)) throw new ReviewError('冻结的原批注已被改动，请重新建立批次。', 409)
  const decisions = batch.decisions
  if (!Array.isArray(decisions) || decisions.length !== frozen.targets.length || new Set(decisions.map(d => d.id)).size !== decisions.length) throw new ReviewError('每条原批注需要且只能有一条处理决定。')
  for (const target of frozen.targets) {
    const d = decisions.find(d => d.id === target.id)
    if (!d || !['addressed', 'superseded', 'not-needed', 'blocked'].includes(d.outcome) || typeof d.summary !== 'string' || !Array.isArray(d.evidence) || d.evidence.some(e => typeof e !== 'string' || !e.trim())) throw new ReviewError('处理决定的类型或字段不完整。')
    if (d.outcome !== 'blocked' && (!d.summary.trim() || !d.evidence.length)) throw new ReviewError('已处理意见必须填写说明和证据。')
  }
  return locked(root, () => {
    const statePath = localPath(root, 'annotations.json'), store = readJson(statePath)
    if (store.projectId !== batch.projectId) throw new ReviewError('批次不属于这个项目。', 409)
    const batchHash = hash(canonical(batch)), old = store.operations.find(o => o.id === `resolve_${batch.id}`)
    if (old) { if (old.fingerprint !== batchHash) throw new ReviewError('该批次已核销，不能更换决定后重复核销。', 409); return { resolved: 0, previouslyResolved: old.result.resolved, pending: store.annotations.filter(a => a.status === 'open').length, alreadyApplied: true } }
    for (const target of frozen.targets) {
      const current = store.annotations.find(a => a.id === target.id)
      if (!current || current.version !== target.version || current.status !== 'open') throw new ReviewError('处理期间有原批注被修改、删除或重新打开；整批未核销，请重新读取。', 409)
    }
    const at = new Date().toISOString()
    for (const d of decisions.filter(d => d.outcome !== 'blocked')) {
      const item = store.annotations.find(a => a.id === d.id)
      item.status = 'resolved'; item.version++; item.updatedAt = at
      item.resolution = { ...d, batchId: batch.id, at }
      item.history.push({ action: 'resolve', version: item.version, at, resolution: item.resolution })
    }
    const result = { resolved: decisions.filter(d => d.outcome !== 'blocked').length, pending: store.annotations.filter(a => a.status === 'open').length }
    store.operations.push({ id: `resolve_${batch.id}`, fingerprint: batchHash, result })
    atomicJson(statePath, store); return result
  })
}
