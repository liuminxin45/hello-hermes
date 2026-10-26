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
  const catalog = readJson('content/chapters.json').filter(chapter => chapter.id === '03')
  const verification = structuredClone(readJson('content/verification.json'))
  assert.deepEqual(validateCatalog(catalog, verification), [])
  delete verification.chapters['03'].upstreams
  assert.ok(validateCatalog(catalog, verification).some(error => error.includes('missing verification')))
  assert.ok(validateCatalog(catalog, readJson('content/verification.json'), undefined, path => !path.endsWith('2026-10-26-ch03.md')).some(error => error.includes('missing internal review notes')))
})

test('public evidence remains required by default and internal chapters cannot restore the citation banner', () => {
  const catalog = readJson('content/chapters.json').filter(chapter => chapter.id === '03')
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
