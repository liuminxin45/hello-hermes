import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { request } from 'node:http'
import { atomicJson, writeManifest, getPage, mutate, readStore, localPath, beginReview, resolveReview, inputDigest, readJson } from '../scripts/review/core.mjs'
import { locateText } from '../scripts/review/anchors.mjs'
import { createReviewServer } from '../scripts/review/server.mjs'

function fixture(t) {
  const base = realpathSync(tmpdir()), root = mkdtempSync(resolve(base, 'hello-hermes-review-test-'))
  t.after(() => { assert.equal(dirname(root), base); assert.ok(basename(root).startsWith('hello-hermes-review-test-')); rmSync(root, { recursive: true, force: true }) })
  for (const folder of ['docs/chapters', 'docs/public/images', 'docs/.vitepress/dist/chapters', 'content', 'editorial']) mkdirSync(resolve(root, folder), { recursive: true })
  atomicJson(resolve(root, 'content/chapters.json'), [{ id: '01', slug: '01-intro', status: 'published' }])
  atomicJson(resolve(root, 'content/verification.json'), {})
  atomicJson(resolve(root, 'editorial/figures.json'), [])
  atomicJson(resolve(root, 'package.json'), {})
  writeFileSync(resolve(root, 'docs/chapters/01-intro.md'), '---\ntitle: 示例章节\n---\n# 示例章节\n\n第一段原文，用来检查批注。\n')
  writeFileSync(resolve(root, 'docs/.vitepress/dist/chapters/01-intro.html'), '<html><head></head><body><main class="vp-doc"><p>第一段原文，用来检查批注。</p></main></body></html>')
  writeManifest(root)
  const page = getPage(root, '/hello-hermes/chapters/01-intro.html')
  const add = (comment = '请解释这一句。') => ({ operationId: randomUUID(), action: 'add', id: randomUUID(), pageUrl: page.url, comment, anchor: { kind: 'text', quote: '第一段原文', prefix: '', suffix: '，用来检查批注。', start: 0, end: 5, sectionId: 'intro', revision: page.revision } })
  return { root, page, add }
}
function decisions(root, result, outcomes) {
  const batch = readJson(result.path)
  batch.decisions = batch.targets.map((a, i) => ({ id: a.id, outcome: outcomes?.[i] || 'addressed', summary: '已补充说明。', evidence: ['docs/chapters/01-intro.md'] }))
  atomicJson(result.path, batch)
  atomicJson(resolve(dirname(result.path), 'validation.json'), { passed: true, inputDigest: inputDigest(root) })
  return batch
}

test('review saves UTF-8, retains original history and deduplicates a lost-response retry', t => {
  const { root, add } = fixture(t), op = add('<img src=x onerror=alert(1)> 中文意见')
  assert.deepEqual(mutate(root, op), mutate(root, op))
  assert.equal(readStore(root).annotations.length, 1)
  assert.throws(() => mutate(root, { ...op, comment: '不同内容' }), /同一操作/)
  mutate(root, { operationId: randomUUID(), action: 'update', id: op.id, expectedVersion: 1, comment: '较新的意见' })
  const item = readStore(root).annotations[0]
  assert.equal(item.version, 2); assert.equal(item.history[0].comment, op.comment)
  assert.equal(item.comment, '较新的意见')
})
test('two tabs can add independently; a stale edit never overwrites a newer comment', t => {
  const { root, add } = fixture(t), a = add(), b = add('另一页签的意见')
  mutate(root, a); mutate(root, b)
  mutate(root, { operationId: randomUUID(), action: 'update', id: a.id, expectedVersion: 1, comment: '新意见' })
  assert.throws(() => mutate(root, { operationId: randomUUID(), action: 'update', id: a.id, expectedVersion: 1, comment: '旧页签覆盖' }), /已被修改/)
  assert.equal(readStore(root).annotations.length, 2)
  assert.equal(readStore(root).annotations[0].comment, '新意见')
})
test('stale page revisions and missing source files reject new anchors without changing saved data', t => {
  const { root, add } = fixture(t), op = add()
  mutate(root, op)
  writeFileSync(resolve(root, 'docs/chapters/01-intro.md'), '# 已改版\n新内容')
  assert.throws(() => mutate(root, add()), /正文版本/)
  assert.equal(readStore(root).annotations.length, 1)
})
test('replacing a figure at the same URL invalidates the page revision too', t => {
  const { root, page } = fixture(t), source = resolve(root, page.sourcePath)
  writeFileSync(source, readFileSync(source, 'utf8') + '\n<TeachingFigure src="/images/sample.webp" />')
  writeFileSync(resolve(root, 'docs/public/images/sample.webp'), 'original figure')
  writeManifest(root)
  const before = getPage(root, page.url)
  assert.equal(before.stale, false)
  writeFileSync(resolve(root, 'docs/public/images/sample.webp'), 'updated figure')
  assert.equal(getPage(root, page.url).stale, true)
  writeManifest(root)
  assert.notEqual(getPage(root, page.url).revision, before.revision)
})
test('frozen batches preserve original source, keep newly added comments and resolve only selected targets', t => {
  const { root, add } = fixture(t), first = add(), second = add('还需讨论')
  mutate(root, first); mutate(root, second)
  const result = beginReview(root), later = add('处理期间新加')
  mutate(root, later)
  const before = readFileSync(resolve(root, 'docs/chapters/01-intro.md'), 'utf8')
  writeFileSync(resolve(root, 'docs/chapters/01-intro.md'), before + '\n补充解释。')
  decisions(root, result, ['addressed', 'blocked'])
  assert.deepEqual(resolveReview(root, result.path), { resolved: 1, pending: 2 })
  assert.equal(readFileSync(resolve(dirname(result.path), 'snapshot/docs/chapters/01-intro.md'), 'utf8'), before)
  const again = resolveReview(root, result.path)
  assert.equal(again.resolved, 0); assert.equal(again.alreadyApplied, true)
  const item = readStore(root).annotations.find(a => a.id === first.id)
  assert.equal(item.anchor.quote, first.anchor.quote); assert.equal(item.history.at(-1).action, 'resolve')
  mutate(root, { operationId: randomUUID(), action: 'reopen', id: item.id, expectedVersion: item.version })
  assert.equal(resolveReview(root, result.path).pending, 3)
})
test('editing a frozen comment blocks the whole batch; unrelated comments are not accidentally resolved', t => {
  const { root, add } = fixture(t), a = add(), b = add('另一条')
  mutate(root, a); mutate(root, b)
  const result = beginReview(root); decisions(root, result)
  mutate(root, { operationId: randomUUID(), action: 'update', id: a.id, expectedVersion: 1, comment: '用户后来的要求' })
  assert.throws(() => resolveReview(root, result.path), /整批未核销/)
  assert.ok(readStore(root).annotations.every(a => a.status === 'open'))
})
test('resolution requires current validation and untampered frozen targets', t => {
  const { root, add } = fixture(t); mutate(root, add())
  const result = beginReview(root)
  assert.throws(() => resolveReview(root, result.path), /先对当前正文/)
  decisions(root, result)
  writeFileSync(resolve(root, 'docs/chapters/01-intro.md'), '# 另一次改稿')
  assert.throws(() => resolveReview(root, result.path), /旧验证不能核销/)
  decisions(root, result)
  const batch = readJson(result.path); batch.targets[0].comment = '偷偷替换原意见'; atomicJson(result.path, batch)
  assert.throws(() => resolveReview(root, result.path), /冻结的原批注/)
})
test('editing a resolved comment reopens it, while deletion retains its original and resolution history', t => {
  const { root, add } = fixture(t), op = add(); mutate(root, op)
  const result = beginReview(root); decisions(root, result); resolveReview(root, result.path)
  mutate(root, { operationId: randomUUID(), action: 'update', id: op.id, expectedVersion: 2, comment: '还需要进一步修改' })
  assert.equal(readStore(root).annotations[0].status, 'open')
  mutate(root, { operationId: randomUUID(), action: 'delete', id: op.id, expectedVersion: 3 })
  const item = readStore(root).annotations[0]
  assert.equal(item.status, 'deleted'); assert.equal(item.history[0].comment, op.comment)
  assert.ok(item.history.some(h => h.action === 'resolve'))
})
test('text anchors survive nearby insertions but do not drift to deleted, duplicate or different-section text', () => {
  const text = '引言 较早的背景 选中的文字 后面的说明 结尾', quote = '选中的文字', start = text.indexOf(quote)
  const anchor = { quote, start, end: start + quote.length, prefix: text.slice(0, start), suffix: text.slice(start + quote.length), sectionId: 'part', revision: 'v1' }
  assert.equal(locateText('新增段落 ' + text, anchor, 'v2', [{ id: 'part', start: 0 }]).start, start + 5)
  assert.equal(locateText(text + ' ' + text, { ...anchor, revision: 'old' }, 'v2', [{ id: 'part', start: 0 }]), null)
  assert.equal(locateText('另一个段落 选中的文字 完全不同的结尾', anchor, 'v2', [{ id: 'part', start: 0 }]), null)
  assert.equal(locateText(text, anchor, 'v2', [{ id: 'other', start: 0 }]), null)
  assert.equal(locateText(text.replace(quote, '被改写的文字'), anchor, 'v2', [{ id: 'part', start: 0 }]), null)
})
test('local server protects writes, rejects real Host spoofing and keeps private data outside static pages', async t => {
  const { root, add, page } = fixture(t), running = await createReviewServer({ root })
  t.after(() => new Promise(done => { running.server.closeAllConnections(); running.server.close(done) }))
  const get = (path, options) => fetch(running.origin + path, options)
  assert.equal((await get('/__review/api/annotations')).status, 403)
  assert.equal((await get('/__review/session', { headers: { Origin: 'https://elsewhere.example' } })).status, 403)
  assert.equal(await new Promise(done => { const req = request(running.origin + '/__review/health', { headers: { Host: 'evil.example' } }, res => { res.resume(); done(res.statusCode) }); req.end() }), 403)
  assert.equal((await get('/hello-hermes/%2e%2e/.review/annotations.json')).status, 404)
  const session = await (await get('/__review/session')).json(), headers = { 'X-Review-Token': session.token, 'Content-Type': 'application/json' }
  assert.equal((await get('/__review/api/annotations', { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415)
  assert.equal((await get('/__review/api/annotations', { method: 'POST', headers, body: 'broken' })).status, 400)
  assert.equal((await get('/__review/api/annotations', { method: 'POST', headers, body: JSON.stringify({ filler: 'a'.repeat(66000) }) })).status, 413)
  const op = add(); assert.equal((await get('/__review/api/annotations', { method: 'POST', headers, body: JSON.stringify(op) })).status, 200)
  const html = await (await get(page.url)).text()
  assert.ok(html.includes('/__review/client.mjs')); assert.ok(!html.includes(session.token)); assert.ok(!html.includes(op.comment))
  const original = readFileSync(resolve(root, 'docs/.vitepress/dist/chapters/01-intro.html'), 'utf8')
  assert.ok(!original.includes('__review'))
  assert.equal((await get('/__review/client.mjs')).status, 200)
})
