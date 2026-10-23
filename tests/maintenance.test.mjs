import test from 'node:test'
import assert from 'node:assert/strict'
import { collectReport, classifyDiff, deliveryDecision, branch } from '../scripts/check-upstream.mjs'

const base = 'a'.repeat(40), stable = 'b'.repeat(40), main = 'c'.repeat(40)
const catalog = [{ id: '01', status: 'published' }, { id: '02', status: 'planned' }]
const verification = { chapters: { '01': { upstreams: { hermes: { repository: 'NousResearch/hermes-agent', tag: 'v1', commit: base, paths: ['agent/', 'website/docs/'] } } } } }
function api({ next = base, tip = base, files = [], fail = false, total = 1 } = {}) {
  return async endpoint => {
    if (fail) throw new Error('network unavailable')
    if (endpoint.endsWith('/releases/latest')) return { tag_name: 'v2', html_url: 'https://example.test/v2', draft: false, prerelease: false }
    if (endpoint.endsWith('/commits/v2')) return { sha: next }
    if (endpoint.endsWith('/commits/main')) return { sha: tip }
    if (endpoint.includes('/compare/')) return { files, total_commits: total, commits: [{}] }
    return { default_branch: 'main' }
  }
}
const collect = options => collectReport({ catalog, verification, api: api(options), now: '2026-10-23T00:00:00Z' })

test('unchanged stable version produces a report without content or baseline mutation', async () => {
  const before = JSON.stringify(verification)
  const report = await collect()
  assert.equal(report.status, 'current')
  assert.equal(report.baselines[0].stableChanged, false)
  assert.deepEqual(deliveryDecision(report, { changed: false }), { action: 'report-only', reason: 'No substantive content change; do not create an empty commit or PR.' })
  assert.equal(JSON.stringify(verification), before)
})
test('core changes map only to published chapters, preserving full paths and patch evidence', async () => {
  const report = await collect({ next: stable, tip: stable, files: [{ filename: 'agent/new_loop.py', status: 'added', patch: '+new behavior' }] })
  assert.equal(report.status, 'review-required')
  assert.deepEqual(report.baselines[0].affectedChapters, ['01'])
  assert.equal(report.baselines[0].files[0].patch, '+new behavior')
})
test('unreleased main changes remain separate from stable content changes', async () => {
  const report = await collect({ tip: main })
  assert.equal(report.status, 'current')
  assert.equal(report.baselines[0].stableChanged, false)
  assert.equal(report.baselines[0].unreleased.changed, true)
  assert.equal(deliveryDecision(report, { changed: false }).action, 'report-only')
})
test('API failures cannot become an up-to-date verdict', async () => {
  const report = await collect({ fail: true })
  assert.equal(report.status, 'error')
  assert.equal(report.errors.length, 1)
  assert.equal(deliveryDecision(report, { changed: true, checksPassed: true }).action, 'blocked')
})
test('renames retain old-path impact; new unmapped modules are explicitly reported', () => {
  const diff = classifyDiff({ files: [{ filename: 'plugins/new_loop.py', previous_filename: 'agent/old_loop.py' }, { filename: 'new_module/core.py' }], total_commits: 1, commits: [{}] }, ['agent/'])
  assert.deepEqual(diff.affected, ['plugins/new_loop.py'])
  assert.deepEqual(diff.unmapped, ['new_module/core.py'])
})
test('truncated GitHub compare results block verification and request full diff', async () => {
  const report = await collect({ next: stable, files: Array.from({ length: 300 }, (_, n) => ({ filename: `agent/${n}.py` })) })
  assert.equal(report.status, 'incomplete')
  assert.equal(deliveryDecision(report, { changed: true, checksPassed: true }).action, 'blocked')
  const commitCap = classifyDiff({ files: [], total_commits: 251, commits: [{}] }, [])
  assert.equal(commitCap.complete, false)
})
test('changed diagrams or failed checks keep delivery unfinished', async () => {
  const report = await collect()
  assert.equal(deliveryDecision(report, { changed: true, checksPassed: true, pendingFigures: ['context.webp'] }).action, 'draft-only')
  assert.equal(deliveryDecision(report, { changed: true, checksPassed: false }).action, 'draft-only')
})
test('existing PR is reused with a stable branch, so repeated calls do not request duplicate PRs', async () => {
  const report = await collect()
  assert.deepEqual(deliveryDecision(report, { changed: true, checksPassed: true, existingPr: { number: 12 } }), { action: 'update-pr', branch, number: 12 })
  assert.deepEqual(deliveryDecision(report, { changed: true, checksPassed: true }), { action: 'create-pr', branch })
})
test('dirty workspace and existing PR are retained for isolation planning without changes', async () => {
  const workspace = { dirty: true, isolationRequired: true, changedFiles: [' M docs/preface.md'], existingPr: { number: 12 } }
  const before = JSON.stringify(workspace)
  const report = await collectReport({ catalog, verification, api: api(), workspace })
  assert.equal(report.workspace.isolationRequired, true)
  assert.equal(JSON.stringify(workspace), before)
})
test('missing verification and unfinished editorial records never count as current', async () => {
  const missing = await collectReport({ catalog, verification: { chapters: {} }, api: api() })
  assert.equal(missing.status, 'error')
  const pending = structuredClone(verification)
  pending.chapters['01'].pending = ['redraw']
  const report = await collectReport({ catalog, verification: pending, api: api() })
  assert.equal(report.status, 'incomplete')
})
