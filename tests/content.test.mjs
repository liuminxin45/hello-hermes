import test from 'node:test'
import assert from 'node:assert/strict'
import { publishedChapters, validateCatalog, readJson, checkLocalLinks } from '../scripts/check-content.mjs'

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
