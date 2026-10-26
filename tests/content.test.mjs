import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, publishedChapters, validateCatalog, readJson, checkLocalLinks } from '../scripts/check-content.mjs'

test('planned and draft chapters never enter the published navigation selection', () => {
  const catalog = [{ id: '01', status: 'published' }, { id: '02', status: 'planned' }, { id: '03', status: 'draft' }]
  assert.deepEqual(publishedChapters(catalog).map(chapter => chapter.id), ['01'])
})
test('all published chapters have real evidence, reviewed figures, learning outcomes and answers', () => {
  assert.deepEqual(validateCatalog(readJson('content/chapters.json'), readJson('content/verification.json')), [])
  assert.deepEqual(checkLocalLinks(), [])
})
test('content gate rejects missing images and pending reviews instead of publishing placeholders', () => {
  const catalog = readJson('content/chapters.json'), verification = structuredClone(readJson('content/verification.json'))
  verification.chapters['01'].pending = ['figure changed']
  const errors = validateCatalog(catalog, verification, undefined, path => !path.endsWith('three-approaches.webp'))
  assert.ok(errors.some(error => error.includes('unfinished review')))
  assert.ok(errors.some(error => error.includes('missing figure')))
})

test('internal evidence keeps verification and review notes mandatory without reader-facing citations', () => {
  const catalog = readJson('content/chapters.json').filter(chapter => chapter.id === '03').map(chapter => ({ ...chapter, prerequisites: [] }))
  const verification = structuredClone(readJson('content/verification.json'))
  assert.deepEqual(validateCatalog(catalog, verification), [])
  delete verification.chapters['03'].upstreams
  assert.ok(validateCatalog(catalog, verification).some(error => error.includes('missing verification')))
  assert.ok(validateCatalog(catalog, readJson('content/verification.json'), undefined, path => !path.endsWith('2026-10-26-curriculum-batch-1.md')).some(error => error.includes('missing internal review notes')))
})

test('legacy pages retain their original verification while the new course uses independent paths', () => {
  const legacy = readJson('content/archive/chapters-v1.json')
  assert.deepEqual(validateCatalog(legacy, readJson('content/archive/verification-v1.json')), [])
  const current = readJson('content/chapters.json')
  assert.ok(current.every(c => c.path.startsWith('learn/')))
  assert.equal(legacy.find(c => c.id === '03').slug, '03-agent-loop')
  assert.equal(current.find(c => c.id === '03').slug, '03-model-input')
})

test('a new lesson cannot publish ahead of a prerequisite or without a case artifact', () => {
  const catalog = structuredClone(readJson('content/chapters.json'))
  catalog.find(c => c.id === '02').status = 'planned'
  delete catalog.find(c => c.id === '03').artifact
  const errors = validateCatalog(catalog, readJson('content/verification.json'))
  assert.ok(errors.some(e => e.includes('unpublished prerequisite')))
  assert.ok(errors.some(e => e.includes('missing learning outcome or case artifact')))
})

test('controlled observation records actual module execution without claiming a model run', () => {
  const report = readJson('docs/public/observations/tool-registry.json')
  const source = readJson('examples/news-brief/registry-source-lock.json')
  assert.equal(report.kind, 'controlled-official-module-execution')
  assert.equal(report.modelCalls, 0)
  assert.deepEqual(report.upstream, source)
  assert.equal(source.commit, readJson('content/verification.json').chapters['04'].upstreams.hermes.commit)
  assert.ok(source.files.every(f => /^[a-f0-9]{64}$/.test(f.sha256)))
  assert.deepEqual(report.visible, ['read_material'])
  assert.ok(report.steps[1].result.error && report.steps[2].result.error)
})

test('delivery observation preserves uncertainty and source provenance without claiming external receipt', () => {
  const report = readJson('docs/public/observations/delivery-queue.json')
  const lock = readJson('examples/news-brief/delivery-source-lock.json')
  assert.deepEqual(report.upstream, lock)
  assert.equal(lock.commit, readJson('content/verification.json').chapters['15'].upstreams.hermes.commit)
  assert.equal(report.modelCalls, 0)
  assert.equal(report.externalSends, 0)
  assert.deepEqual(report.steps.map(s => s.status), ['pending', 'pending', 'delivering', 'unknown', 'unknown', 'delivered', 'failed'])
  assert.equal(report.steps[0].firstContentPreserved, true)
  assert.equal(report.steps[4].claimable, false)
  assert.equal(report.steps[5].localCallbacks, 1)
  assert.equal(report.steps[5].terminalContentPruned, true)
  assert.ok(report.limitations.some(s => s.includes('not proof of external message delivery')))
  assert.ok(lock.files.every(f => /^[a-f0-9]{64}$/.test(f.sha256)))
})

test('public evidence remains required by default and internal chapters cannot restore the citation banner', () => {
  const catalog = readJson('content/chapters.json').filter(chapter => chapter.id === '03').map(chapter => ({ ...chapter, prerequisites: [] }))
  const verification = readJson('content/verification.json')
  const read = path => readFileSync(resolve(root, path), 'utf8')
  const publicErrors = validateCatalog(catalog, verification, path => read(path).replace(/^evidenceDisplay: internal\r?\n/m, ''))
  assert.ok(publicErrors.some(error => error.includes('missing public evidence')))
  assert.ok(publicErrors.some(error => error.includes('missing rendered verification')))
  const internalErrors = validateCatalog(catalog, verification, path => read(path) + '\n<ChapterVerification chapter="03" />')
  assert.ok(internalErrors.some(error => error.includes('unexpected public evidence')))
  const invalidErrors = validateCatalog(catalog, verification, path => read(path).replace('evidenceDisplay: internal', 'evidenceDisplay: hidden'))
  assert.ok(invalidErrors.some(error => error.includes('invalid evidence display')))
})
