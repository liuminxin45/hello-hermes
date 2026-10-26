import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createReviewServer } from '../scripts/review/server.mjs'
import { writeManifest, readStore, readJson, beginReview, atomicJson, localPath } from '../scripts/review/core.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(project)
let playwright
for (const directory of [resolve(project, 'node_modules'), process.env.HELLO_HERMES_TEST_NODE_MODULES, resolve(dirname(process.execPath), '../node_modules')].filter(Boolean)) {
  try { playwright = createRequire(resolve(directory, '_review_probe.cjs'))('playwright'); break } catch {}
}
if (!playwright) throw new Error('浏览器检查需要可用的 Playwright。可通过 HELLO_HERMES_TEST_NODE_MODULES 指向已安装的 node_modules；后台运行本身不需要此依赖。')
const fixture = resolve('.cache', `review-browser-${Date.now()}`)
mkdirSync(fixture, { recursive: true })
for (const part of ['docs', 'content', 'editorial', 'examples', 'scripts', 'tests', 'package.json']) cpSync(part, resolve(fixture, part), { recursive: true, filter: path => !path.includes('.vitepress\\cache') && !path.includes('.vitepress/cache') })
symlinkSync(resolve(project, 'node_modules'), resolve(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
writeManifest(fixture)
const running = await createReviewServer({ root: fixture })
const { chromium } = playwright, browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--proxy-bypass-list=*'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage(), errors = [], checks = []
page.on('pageerror', error => errors.push(error.message))
const lesson = JSON.parse(readFileSync(resolve(project, 'content/chapters.json'), 'utf8')).find(c => c.id === '03')
const lessonPath = lesson.path || `chapters/${lesson.slug}`
const url = running.origin + `/hello-hermes/${lessonPath}.html`
const screenshots = resolve(fixture, 'screenshots'); mkdirSync(screenshots)
async function ready(p = page, address = url) { await p.goto(address, { waitUntil: 'networkidle' }); await p.locator('#hr-status').filter({ hasText: '选中文字' }).waitFor() }
async function select(p = page) {
  const phrase = await p.locator('.vp-doc p').first().evaluate(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) if (node.data.trim().length >= 8) return node.data.trim().slice(0, 8)
    throw new Error('No selectable paragraph')
  })
  await p.evaluate(phrase => {
    const walker = document.createTreeWalker(document.querySelector('.vp-doc'), NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const start = node.data.indexOf(phrase)
      if (start >= 0 && !node.parentElement.closest('dialog')) { const r = new Range(); r.setStart(node, start); r.setEnd(node, start + phrase.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); node.parentElement.scrollIntoView({ block: 'center' }); return }
    }
    throw new Error('phrase not found: ' + phrase)
  }, phrase)
  await p.locator('#hr-selection').waitFor({ state: 'visible' })
  await p.locator('#hr-selection').click()
  await p.locator('#hr-comment').waitFor({ state: 'visible' })
}
async function submit(text, p = page) { await p.locator('#hr-comment').fill(text); await p.locator('#hr-save').click(); await p.locator('#hr-editor').waitFor({ state: 'hidden' }) }
async function panel(p = page) { await p.locator('#hr-open').click(); await p.locator('#hr-panel').waitFor({ state: 'visible' }) }
function command(args) {
  const result = spawnSync(process.execPath, [resolve(project, 'scripts/review.mjs'), ...args, '--root', fixture], { cwd: fixture, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout
}
try {
  await ready()
  await select(); await submit('请解释这一句。<img src=x onerror=alert(1)>')
  assert.equal(readStore(fixture).annotations.length, 1)
  const firstQuote = readStore(fixture).annotations[0].anchor.quote
  assert.ok(firstQuote.length >= 8)
  await panel(); assert.equal(await page.locator('.hr-card img').count(), 0)
  await page.screenshot({ path: resolve(screenshots, 'desktop-panel.png') })
  await page.getByRole('button', { name: '定位原文', exact: true }).first().click()
  await page.locator('#hr-status').filter({ hasText: '已定位原文' }).waitFor()
  checks.push('text add, exact anchor, safe text rendering, locate')

  await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.vp-doc p')].filter(p => !p.closest('dialog, .custom-block')), r = new Range()
    r.setStart(ps[0].firstChild, 0); r.setEnd(ps[1].lastChild, 6)
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); ps[0].scrollIntoView({ block: 'center' })
  })
  await page.locator('#hr-selection').waitFor({ state: 'visible' }); await page.locator('#hr-selection').click(); await submit('跨段意见')
  assert.ok(readStore(fixture).annotations[1].anchor.quote.length > firstQuote.length)
  checks.push('cross-paragraph selection')

  await ready(); await panel()
  const firstId = readStore(fixture).annotations[0].id
  await page.locator('.hr-card').filter({ hasText: '<img src=x' }).getByRole('button', { name: '编辑', exact: true }).click()
  await page.locator('#hr-comment').fill('旧页签意见')
  const other = await context.newPage(); await ready(other); await panel(other)
  await other.locator('.hr-card').filter({ hasText: '<img src=x' }).getByRole('button', { name: '编辑', exact: true }).click()
  await submit('新的用户意见', other)
  await page.locator('#hr-save').click(); await page.locator('#hr-form-error').filter({ hasText: '已被修改' }).waitFor()
  assert.equal(readStore(fixture).annotations.find(a => a.id === firstId).comment, '新的用户意见')
  await page.locator('#hr-cancel').click(); await panel()
  const downloadPromise = page.waitForEvent('download'); await page.locator('#hr-export').click(); const download = await downloadPromise
  const downloadPath = resolve(fixture, 'export.json'); await download.saveAs(downloadPath)
  assert.equal(readJson(downloadPath).drafts.length, 1)
  await page.locator('#hr-close-panel').click(); await other.close()
  checks.push('reload persistence, two-tab version conflict, independent draft and export')

  const beforeLost = readStore(fixture).annotations.length
  let loseResponse = true
  await page.route('**/__review/api/annotations', async route => {
    if (route.request().method() === 'POST' && loseResponse) { loseResponse = false; await route.fetch(); return route.abort('failed') }
    return route.continue()
  })
  await select(); await page.locator('#hr-comment').fill('响应丢失测试'); await page.locator('#hr-save').click()
  await page.locator('#hr-form-error').filter({ hasText: '未保存' }).waitFor()
  assert.equal(readStore(fixture).annotations.length, beforeLost + 1)
  await page.locator('#hr-save').click(); await page.locator('#hr-editor').waitFor({ state: 'hidden' })
  assert.equal(readStore(fixture).annotations.length, beforeLost + 1)
  await page.unroute('**/__review/api/annotations')
  checks.push('lost response retries one idempotent operation without duplicate comment')

  await select(); await page.locator('#hr-comment').fill('断线暂存意见')
  await context.setOffline(true); await page.locator('#hr-save').click(); await page.locator('#hr-form-error').filter({ hasText: '未保存' }).waitFor()
  await page.screenshot({ path: resolve(screenshots, 'offline-draft.png') })
  await context.setOffline(false); await page.locator('#hr-save').click(); await page.locator('#hr-editor').waitFor({ state: 'hidden' })
  checks.push('offline draft recovery')

  await page.locator('.hr-figure-add').nth(1).click(); await submit('图中两条箭头请再核对。')
  assert.equal(readStore(fixture).annotations.at(-1).anchor.kind, 'figure')
  checks.push('figure annotation')

  await page.locator('.VPSidebar a[href*="04-"]').first().click()
  await page.waitForFunction(() => document.querySelector('#hr-status')?.textContent === '选中文字即可批注')
  await page.waitForFunction(() => document.querySelector('#hr-page-title')?.textContent.startsWith('04'))
  await page.evaluate(() => { const p = document.querySelector('.vp-doc p'), r = document.createRange(); r.selectNodeContents(p); getSelection().removeAllRanges(); getSelection().addRange(r); p.scrollIntoView({ block: 'center' }) })
  await page.locator('#hr-selection').waitFor({ state: 'visible' }); await page.locator('#hr-selection').click(); await submit('第四章的隔离批注')
  assert.ok(readStore(fixture).annotations.at(-1).sourcePath.includes('/04-'))
  checks.push('SPA chapter navigation binds comments to the new page')

  for (const theme of ['light', 'dark']) {
    await ready()
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
    await page.setViewportSize({ width: 375, height: 900 }); await panel()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.ok(await page.locator('#hr-panel').evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    await page.screenshot({ path: resolve(screenshots, `mobile-${theme}.png`) })
    await page.locator('#hr-close-panel').click()
  }
  checks.push('mobile light/dark overflow and usable panel')

  const result = beginReview(fixture), batch = readJson(result.path)
  const source = resolve(fixture, `docs/${lessonPath}.md`), original = readFileSync(source, 'utf8')
  assert.ok(original.includes(firstQuote), 'The selected plain text must be present in the Markdown fixture')
  writeFileSync(source, original.replace(firstQuote, '修订后的案例开头'))
  batch.decisions = batch.targets.map((a, i) => ({ id: a.id, outcome: i === 0 ? 'addressed' : 'blocked', summary: i === 0 ? '根据意见调整示例表述。' : '', evidence: i === 0 ? [`docs/${lessonPath}.md`] : [] }))
  atomicJson(result.path, batch)
  command(['validate', '--batch', result.path])
  const resolved = JSON.parse(command(['resolve', '--batch', result.path]))
  assert.equal(resolved.resolved, 1); assert.equal(resolved.pending, batch.targets.length - 1)
  await panel(); await page.locator('#hr-refresh').click()
  await page.locator('#hr-panel-message').filter({ hasText: '刷新整个页面' }).waitFor()
  await page.locator('#hr-close-panel').click()
  await ready(); await panel(); await page.locator('#hr-filter').selectOption('resolved')
  await page.locator('.hr-resolution').filter({ hasText: '根据意见调整示例表述' }).waitFor()
  await page.getByRole('button', { name: '定位原文', exact: true }).first().click()
  await page.locator('#hr-panel-message').filter({ hasText: '原文已变化' }).waitFor()
  checks.push('end-to-end snapshot, source edit, CLI validate/resolve, retained history and no anchor drift')
  assert.ok(!readFileSync(resolve(fixture, `docs/.vitepress/dist/${lessonPath}.html`), 'utf8').includes('/__review/client.mjs'))
  const opened = command(['start']), same = command(['start']), address = command(['status']).trim()
  assert.ok(opened.includes(address)); assert.ok(same.includes(address))
  command(['stop']); assert.ok(command(['status']).includes('未运行'))
  command(['start']); assert.equal(command(['status']).trim(), address); command(['stop'])
  checks.push('CLI background start, reuse, stop and same-port restart retain comments')
  const occupiedPort = Number(new URL(address).port), otherApp = createHttpServer((req, res) => res.end('other app'))
  await new Promise(done => otherApp.listen(occupiedPort, '127.0.0.1', done))
  try {
    command(['start']); assert.notEqual(command(['status']).trim(), address)
    assert.ok(otherApp.listening); command(['stop'])
  } finally { await new Promise(done => otherApp.close(done)) }
  checks.push('occupied remembered port selects another port without stopping the other app')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ fixture, checks, errors, screenshots }, null, 2))
  writeFileSync(resolve(fixture, 'report.json'), JSON.stringify({ checks, errors }, null, 2))
} finally {
  try { command(['stop']) } catch {}
  await browser.close(); running.server.closeAllConnections(); await new Promise(done => running.server.close(done))
}
