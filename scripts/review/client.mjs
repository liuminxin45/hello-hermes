import { normalize, locateText } from '/__review/anchors.mjs'

const ui = document.createElement('div')
ui.id = 'hh-review-root'
ui.innerHTML = `
  <div class="hr-bar" aria-label="本地审阅工具">
    <span class="hr-local">本地审阅</span><button type="button" id="hr-open">批注 · 0</button>
    <span id="hr-status" role="status" aria-live="polite">正在连接…</span>
  </div>
  <button type="button" id="hr-selection" hidden>批注选中文字</button>
  <dialog class="hr-panel" id="hr-panel" aria-labelledby="hr-panel-title">
    <header><div><h2 id="hr-panel-title">本地批注</h2><p id="hr-page-title"></p></div><button type="button" id="hr-close-panel">关闭</button></header>
    <div class="hr-panel-actions"><button type="button" id="hr-refresh">刷新列表</button><button type="button" id="hr-export">导出批注</button><button type="button" id="hr-prompt">复制给 Codex</button></div>
    <div class="hr-filters"><label>范围<select id="hr-scope"><option value="page">当前页</option><option value="all">全书</option></select></label><label>状态<select id="hr-filter"><option value="open">待处理</option><option value="resolved">已处理</option></select></label></div>
    <p class="hr-hint">选中正文后点“批注选中文字”，也可按 Ctrl + Alt + M。标完后，在当前对话说“按批注修改手册”。</p>
    <div id="hr-pending"></div><p id="hr-panel-message" role="status" aria-live="polite"></p><div id="hr-list"></div>
  </dialog>
  <dialog class="hr-editor" id="hr-editor" aria-labelledby="hr-editor-title">
    <form id="hr-form"><header><h2 id="hr-editor-title">添加批注</h2><button type="button" id="hr-cancel">取消</button></header>
      <p id="hr-section" class="hr-hint"></p><blockquote id="hr-quote"></blockquote>
      <label for="hr-comment">修改意见</label><textarea id="hr-comment" rows="5" maxlength="8000" required placeholder="例如：这里跳得太快，先用一个例子解释为什么要重试。"></textarea>
      <p id="hr-form-error" role="alert"></p><footer><span class="hr-hint">Ctrl + Enter 保存</span><button type="submit" class="hr-primary" id="hr-save">保存批注</button></footer>
    </form>
  </dialog>`
document.body.append(ui); document.body.classList.add('hh-review-local')
const $ = id => ui.querySelector(`#${id}`)
const panel = $('hr-panel'), editor = $('hr-editor'), selected = $('hr-selection'), status = $('hr-status')
let session, page, state = { annotations: [] }, selectionAnchor, editing, pagePath = '', loadingPath = '', loadId = 0
let storageAvailable = true
const memory = new Map()
const keyPrefix = () => `hello-hermes-review:${session?.projectId}:`
function pending() {
  const entries = new Map(memory)
  try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith(keyPrefix())) entries.set(key, JSON.parse(localStorage.getItem(key))) } } catch { storageAvailable = false }
  return [...entries.values()]
}
function stash(entry) {
  const key = keyPrefix() + entry.operation.operationId
  memory.set(key, entry)
  try { localStorage.setItem(key, JSON.stringify(entry)) } catch { storageAvailable = false }
}
function unstage(op) {
  const key = keyPrefix() + op.operationId; memory.delete(key)
  try { localStorage.removeItem(key) } catch {}
}
async function connect() {
  const response = await fetch('/__review/session', { cache: 'no-store' })
  if (!response.ok) throw new Error('后台未连接，请重新启动本地审阅。')
  session = await response.json()
}
async function api(path, operation, retry = true) {
  const response = await fetch('/__review/api/' + path, { method: operation ? 'POST' : 'GET', cache: 'no-store', headers: { 'X-Review-Token': session.token, ...(operation ? { 'Content-Type': 'application/json' } : {}) }, ...(operation ? { body: JSON.stringify(operation) } : {}) })
  if (response.status === 403 && retry) { await connect(); return api(path, operation, false) }
  const result = await response.json()
  if (!response.ok) { const e = new Error(result.error || '本地保存失败。'); e.status = response.status; throw e }
  return result
}
function textModel() {
  const root = document.querySelector('.vp-doc'), points = [], sections = []
  if (!root) return { root, text: '', points, sections }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(node) { return node.parentElement?.closest('dialog, button, script, style, .header-anchor, .hr-figure-add') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT } })
  let node, text = '', previousBlock, whitespace
  while ((node = walker.nextNode())) {
    const block = node.parentElement.closest('p,li,td,th,pre,h1,h2,h3,h4,figcaption') || root
    if (block !== previousBlock && text) whitespace = { node, start: 0, end: 0 }
    previousBlock = block
    const heading = node.parentElement.closest('h1,h2,h3,h4')
    if (heading?.id && !sections.some(s => s.id === heading.id)) sections.push({ id: heading.id, title: normalize(heading.textContent.replace(/^#\s*/, '')), start: text.length })
    for (let i = 0; i < node.data.length; i++) {
      const point = { node, start: i, end: i + 1 }
      if (/\s/u.test(node.data[i])) { whitespace = point; continue }
      if (whitespace && text) { text += ' '; points.push(whitespace) }
      whitespace = null; text += node.data[i]; points.push(point)
    }
  }
  return { root, text, points, sections }
}
function sectionFor(model, offset) { return model.sections.filter(s => s.start <= offset).at(-1) || { id: '', title: page?.title || '' } }
function capture() {
  if (!page || page.stale || editor.open || panel.open) return null
  const selection = window.getSelection()
  if (!selection?.rangeCount || selection.isCollapsed) return null
  const range = selection.getRangeAt(0), model = textModel()
  if (!model.root?.contains(range.commonAncestorContainer)) return null
  let start = -1, end = -1
  for (let i = 0; i < model.points.length; i++) {
    const p = model.points[i]
    if (range.comparePoint(p.node, p.start) >= 0 && range.comparePoint(p.node, p.end) <= 0) { if (start < 0) start = i; end = i + 1 }
  }
  while (model.text[start] === ' ') start++
  while (end > start && model.text[end - 1] === ' ') end--
  if (start < 0 || end <= start || end - start > 6000) return null
  const section = sectionFor(model, start), block = model.points[start].node.parentElement.closest('p,li,td,th,pre,h1,h2,h3,figcaption')
  return { kind: 'text', revision: page.revision, quote: model.text.slice(start, end), start, end, prefix: model.text.slice(Math.max(0, start - 64), start), suffix: model.text.slice(end, end + 64), sectionId: section.id, section: section.title, blockText: normalize(block?.textContent || '').slice(0, 6000) }
}
function selectionChanged() {
  if (editor.open || panel.open) { selected.hidden = true; return }
  selectionAnchor = capture()
  selected.hidden = !selectionAnchor
  if (selectionAnchor) {
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect()
    selected.style.left = `${Math.max(8, Math.min(innerWidth - 175, rect.left))}px`
    selected.style.top = `${Math.max(8, Math.min(innerHeight - 66, rect.bottom + 8))}px`
  }
}
let selectTimer
document.addEventListener('selectionchange', () => { clearTimeout(selectTimer); selectTimer = setTimeout(selectionChanged, 100) })
selected.addEventListener('mousedown', event => event.preventDefault())
selected.addEventListener('click', () => openEditor(selectionAnchor))
document.addEventListener('keydown', event => {
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') { const anchor = capture(); if (anchor) { event.preventDefault(); openEditor(anchor) } }
})
function openEditor(anchor, item) {
  if (!anchor) return
  editing = item ? { item, anchor } : { anchor, page: { ...page } }
  if (panel.open) panel.close()
  selected.hidden = true
  $('hr-editor-title').textContent = item ? '编辑批注' : '添加批注'
  $('hr-section').textContent = anchor.section || page?.title || ''
  $('hr-quote').textContent = anchor.quote
  $('hr-comment').value = item?.comment || ''; $('hr-comment').readOnly = false; $('hr-form-error').textContent = ''
  editor.showModal(); $('hr-comment').focus()
}
$('hr-cancel').onclick = () => editor.close()
$('hr-comment').onkeydown = event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); $('hr-form').requestSubmit() } }
async function save(operation) {
  const entry = { operation, at: new Date().toISOString() }; stash(entry); renderPending()
  try {
    await api('annotations', operation); unstage(operation)
    await refresh(); status.textContent = '已保存到本地文件'; return true
  } catch (error) {
    entry.error = error.message; entry.conflict = error.status === 409; stash(entry); renderPending()
    status.textContent = storageAvailable ? '有意见未保存到文件，草稿已保留' : '保存失败，请导出草稿'
    throw error
  }
}
$('hr-form').onsubmit = async event => {
  event.preventDefault()
  const comment = $('hr-comment').value.trim(); if (!comment) { $('hr-form-error').textContent = '请填写修改意见。'; return }
  const operation = editing.operation ||= editing.item ? { operationId: crypto.randomUUID(), action: 'update', id: editing.item.id, expectedVersion: editing.item.version, comment } : { operationId: crypto.randomUUID(), action: 'add', id: crypto.randomUUID(), pageUrl: editing.page.url, anchor: editing.anchor, comment }
  $('hr-save').disabled = true; $('hr-save').textContent = '正在保存…'
  try { await save(operation); editor.close(); window.getSelection()?.removeAllRanges() }
  catch (error) { $('hr-comment').readOnly = true; $('hr-form-error').textContent = `${error.message} 当前意见未保存；可重试这次操作，或取消后在批注列表中导出草稿。` }
  finally { $('hr-save').disabled = false; $('hr-save').textContent = '保存批注' }
}
const element = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el }
function button(text, action) { const el = element('button', text); el.type = 'button'; el.onclick = action; return el }
function message(text) { $('hr-panel-message').textContent = text; status.textContent = text }
async function refresh() {
  state = await api('annotations'); renderList(); renderPending()
  $('hr-open').textContent = `批注 · ${state.annotations.filter(a => a.status === 'open').length}`
}
function renderPending() {
  const target = $('hr-pending'), entries = pending(); target.replaceChildren()
  if (!entries.length) return
  target.append(element('h3', `未保存草稿 · ${entries.length}`))
  for (const entry of entries) {
    const card = element('div', undefined, 'hr-draft')
    card.append(element('p', entry.operation.comment || entry.operation.action), element('p', entry.error || '正在等待保存', 'hr-hint'))
    card.append(button('重试保存', async () => { try { await save(entry.operation) } catch (error) { message(error.message) } }))
    card.append(button('放弃这份草稿', () => { if (confirm('只移除这份未同步草稿，已保存的批注不会删除。')) { unstage(entry.operation); renderPending() } }))
    target.append(card)
  }
}
function renderList() {
  const list = $('hr-list'); list.replaceChildren()
  const items = state.annotations.filter(a => a.status === $('hr-filter').value && ($('hr-scope').value === 'all' || a.pageId === page?.id))
  if (!items.length) { list.append(element('p', '这里还没有批注。选中一段正文即可添加。', 'hr-empty')); return }
  for (const item of items.slice().reverse()) {
    const card = element('article', undefined, 'hr-card')
    card.append(element('p', `${item.title} · ${item.status === 'open' ? '待处理' : '已处理'}`, 'hr-card-meta'))
    const quote = element('blockquote', item.anchor.quote); card.append(quote, element('p', item.comment, 'hr-comment-text'))
    if (item.resolution) card.append(element('p', item.resolution.summary, 'hr-resolution'))
    const actions = element('div', undefined, 'hr-card-actions')
    actions.append(button('定位原文', () => locate(item)), button('编辑', () => openEditor(item.anchor, item)))
    if (item.status === 'resolved') actions.append(button('重新打开', async () => { try { await save({ operationId: crypto.randomUUID(), action: 'reopen', id: item.id, expectedVersion: item.version }) } catch (e) { message(e.message) } }))
    actions.append(button('删除', async () => {
      if (!confirm('删除这条批注？原文、意见及历史仍会保留在本地记录中。')) return
      try { await save({ operationId: crypto.randomUUID(), action: 'delete', id: item.id, expectedVersion: item.version }) } catch (e) { message(e.message) }
    }))
    const history = element('details'), summary = element('summary', `记录 · ${item.history.length}`)
    history.append(summary)
    for (const h of item.history) history.append(element('p', `${new Date(h.at).toLocaleString()} · v${h.version} · ${h.action}\n${h.comment || h.resolution?.summary || ''}`, 'hr-history'))
    card.append(actions, history); list.append(card)
  }
}
function rangeFor(model, found) {
  const start = model.points[found.start], end = model.points[found.end - 1]
  if (!start || !end) return null
  const range = new Range(); range.setStart(start.node, start.start); range.setEnd(end.node, end.end); return range
}
async function locate(item) {
  if (item.pageId !== page?.id) { location.href = item.pageUrl + '#review=' + encodeURIComponent(item.id); return }
  const model = textModel()
  let target
  if (item.anchor.kind === 'figure') {
    const matches = [...document.querySelectorAll('.teaching-figure')].filter(f => {
      const img = f.querySelector('.figure-open img'); if (!img || new URL(img.src).pathname !== item.anchor.src) return false
      const textNode = model.points.find(p => f.contains(p.node))
      const section = textNode ? sectionFor(model, model.points.indexOf(textNode)) : null
      return !item.anchor.sectionId || section?.id === item.anchor.sectionId
    })
    if (matches.length === 1) target = matches[0]
  } else {
    const found = locateText(model.text, item.anchor, page.revision, model.sections)
    const range = found && rangeFor(model, found)
    if (range) {
      target = range.startContainer.parentElement
      if (globalThis.Highlight && CSS.highlights) CSS.highlights.set('hermes-review', new Highlight(range))
    }
  }
  if (!target) { message('原文已变化或无法唯一定位，未跳到其他相似段落。请结合保存的原文与小节核对。'); return }
  if (panel.open) panel.close()
  target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  status.textContent = item.anchor.revision === page.revision ? '已定位原文' : '正文版本已更新，已按原文和上下文定位'
}
function augmentFigures() {
  for (const figure of document.querySelectorAll('.teaching-figure')) {
    if (figure.querySelector('.hr-figure-add')) continue
    const b = button('批注此图', () => {
      if (!page || page.stale) return message('请重新构建并刷新后再添加批注。')
      const model = textModel(), point = model.points.find(p => figure.contains(p.node)), section = point ? sectionFor(model, model.points.indexOf(point)) : { id: '', title: '' }
      openEditor({ kind: 'figure', revision: page.revision, src: new URL(figure.querySelector('.figure-open img').src).pathname, quote: normalize(figure.querySelector('figcaption').textContent.replace('批注此图', '')), sectionId: section.id, section: section.title })
    })
    b.className = 'hr-figure-add'; figure.querySelector('figcaption')?.append(b)
  }
}
async function loadPage() {
  const pathname = location.pathname
  if (loadingPath === pathname || pagePath === pathname) { augmentFigures(); return }
  loadingPath = pathname; const id = ++loadId
  try {
    const next = await api('page?path=' + encodeURIComponent(pathname))
    if (id !== loadId) return
    const rendered = document.querySelector('meta[name="hello-hermes-review-version"]')
    const initialVersionMismatch = !page && rendered?.dataset.page === encodeURIComponent(next.id) && rendered.content !== next.revision
    if (initialVersionMismatch || page?.id === next.id && page.revision !== next.revision) {
      page = { ...next, revision: page?.revision || rendered.content, stale: true }; pagePath = pathname
      message('正文版本已更新，请刷新整个页面后再添加批注。'); await refresh(); return
    }
    page = next; pagePath = pathname; selected.hidden = true
    $('hr-page-title').textContent = page.title
    status.textContent = page.stale ? '正文已改，请构建后刷新再批注' : '选中文字即可批注'
    await refresh(); augmentFigures()
    const match = location.hash.match(/^#review=(.+)$/)
    if (match) { const item = state.annotations.find(a => a.id === decodeURIComponent(match[1])); if (item) setTimeout(() => locate(item), 200) }
  } catch (error) { if (id === loadId) { page = null; pagePath = pathname; message(error.message) } }
  finally { if (id === loadId) loadingPath = '' }
}
$('hr-open').onclick = async () => { selected.hidden = true; panel.showModal(); try { await refresh() } catch (error) { message('后台未连接；未保存草稿仍可导出。'); renderPending() } }
$('hr-close-panel').onclick = () => panel.close()
$('hr-refresh').onclick = async () => { try { pagePath = ''; await loadPage(); await refresh(); message(page?.stale ? '正文版本已更新，请刷新整个页面后再添加批注。' : '列表已刷新') } catch (error) { message(error.message) } }
$('hr-scope').onchange = renderList; $('hr-filter').onchange = renderList
$('hr-export').onclick = () => {
  const blob = new Blob([JSON.stringify({ projectId: session?.projectId, exportedAt: new Date().toISOString(), annotations: state.annotations, drafts: pending() }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hello-hermes-批注.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
$('hr-prompt').onclick = async () => {
  const text = '请在 hello-hermes 仓库按本地批注修改手册。先运行 node scripts/review.mjs list 和 begin，冻结本轮意见，逐条改稿并验证后核销；保留新批注、原文和处理历史。'
  try { await navigator.clipboard.writeText(text); message('已复制，粘贴到当前 Codex 对话即可。') } catch { message(text) }
}
window.addEventListener('storage', () => renderPending())
try {
  await connect(); await loadPage(); renderPending()
  let routeTimer
  new MutationObserver(() => { clearTimeout(routeTimer); routeTimer = setTimeout(loadPage, 120) }).observe(document.querySelector('#app'), { childList: true, subtree: true })
  window.addEventListener('popstate', loadPage)
} catch (error) { message('无法连接本地后台，请运行 node scripts/review.mjs start 后刷新。') }
