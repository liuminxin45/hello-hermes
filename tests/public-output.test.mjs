import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, basename } from 'node:path'
import { checkPublicOutput } from '../scripts/check-public-output.mjs'

function fixture(t) {
  const base = realpathSync(tmpdir()), root = mkdtempSync(resolve(base, 'hello-hermes-public-test-'))
  t.after(() => { assert.equal(dirname(root), base); assert.ok(basename(root).startsWith('hello-hermes-public-test-')); rmSync(root, { recursive: true, force: true }) })
  return root
}
test('public reading pages may describe the local workflow without shipping its runtime', t => {
  const root = fixture(t)
  writeFileSync(resolve(root, 'index.html'), '<p>本地运行 npm run review，批注保存在 .review/annotations.json。</p>')
  assert.deepEqual(checkPublicOutput(root), [])
})
test('public output rejects annotation controls and private review files', t => {
  const root = fixture(t)
  writeFileSync(resolve(root, 'index.html'), '<script type="module" src="/__review/client.mjs"></script>')
  mkdirSync(resolve(root, '.review'))
  writeFileSync(resolve(root, '.review/session.json'), '{}')
  const errors = checkPublicOutput(root)
  assert.ok(errors.some(e => e.includes('local review runtime')))
  assert.ok(errors.some(e => e.includes('private review artifact')))
})
