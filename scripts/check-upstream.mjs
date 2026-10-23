import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root, readJson, publishedChapters } from './check-content.mjs'

export const branch = 'codex/sync-upstream'
export function ghApi(endpoint) {
  return JSON.parse(execFileSync('gh', ['api', endpoint], { cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 24 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }))
}
export function classifyDiff(comparison, paths) {
  const files = comparison.files || []
  const complete = files.length < 300 && (comparison.total_commits || 0) <= (comparison.commits?.length ?? 250)
  const matches = path => paths.some(watched => watched.endsWith('/') ? path.startsWith(watched) : path === watched)
  const affected = files.filter(file => matches(file.filename) || (file.previous_filename && matches(file.previous_filename))).map(file => file.filename)
  return { complete, affected, unmapped: files.filter(file => !matches(file.filename) && !(file.previous_filename && matches(file.previous_filename))).map(file => file.filename), files: files.map(file => ({ path: file.filename, previousPath: file.previous_filename, status: file.status, additions: file.additions, deletions: file.deletions, patch: file.patch ?? null })) }
}

export async function collectReport({ catalog, verification, api = ghApi, workspace = {}, now = new Date().toISOString() }) {
  const report = { checkedAt: now, status: 'current', branch, workspace, baselines: [], errors: [], pending: [], note: 'Collection is not chapter verification. Unreleased commits are tracked separately. No verification record is modified.' }
  const groups = new Map()
  for (const chapter of publishedChapters(catalog)) {
    const record = verification.chapters?.[chapter.id]
    if (!record?.upstreams || !Object.keys(record.upstreams).length) { report.errors.push({ chapter: chapter.id, error: 'Published chapter has no verification baseline' }); continue }
    if (record.pending?.length) report.pending.push({ chapter: chapter.id, items: record.pending })
    for (const [name, source] of Object.entries(record.upstreams)) {
      const key = `${source.repository}@${source.commit}`
      if (!groups.has(key)) groups.set(key, { name, ...source, chapters: [] })
      groups.get(key).chapters.push({ id: chapter.id, paths: source.paths })
    }
  }
  for (const source of groups.values()) {
    try {
      const prefix = `repos/${source.repository}`
      const latest = await api(`${prefix}/releases/latest`)
      if (!latest.tag_name || latest.draft || latest.prerelease) throw new Error('Latest release is missing or is not stable')
      const stable = await api(`${prefix}/commits/${encodeURIComponent(latest.tag_name)}`)
      if (!/^[a-f0-9]{40}$/.test(stable.sha || '')) throw new Error('Release did not resolve to a commit')
      const repo = await api(prefix)
      if (!repo.default_branch) throw new Error('Cannot resolve upstream default branch')
      const main = await api(`${prefix}/commits/${encodeURIComponent(repo.default_branch)}`)
      if (!/^[a-f0-9]{40}$/.test(main.sha || '')) throw new Error('Cannot resolve upstream main commit')
      const changed = stable.sha !== source.commit
      const comparison = changed ? await api(`${prefix}/compare/${source.commit}...${stable.sha}`) : { files: [], commits: [], total_commits: 0 }
      const combined = classifyDiff(comparison, [...new Set(source.chapters.flatMap(chapter => chapter.paths))])
      const affectedChapters = source.chapters.filter(chapter => classifyDiff(comparison, chapter.paths).affected.length).map(chapter => chapter.id)
      report.baselines.push({ repository: source.repository, previousTag: source.tag, previousCommit: source.commit, latestTag: latest.tag_name, latestCommit: stable.sha, releaseUrl: latest.html_url, stableChanged: changed, affectedChapters, chapters: source.chapters.map(chapter => chapter.id), ...combined, unreleased: { changed: main.sha !== stable.sha, commit: main.sha, branch: repo.default_branch, compareUrl: `https://github.com/${source.repository}/compare/${stable.sha}...${main.sha}` }, compareUrl: `https://github.com/${source.repository}/compare/${source.commit}...${stable.sha}` })
    } catch (error) { report.errors.push({ repository: source.repository, error: String(error.message || error).slice(0, 1200) }) }
  }
  if (report.errors.length) report.status = 'error'
  else if (report.pending.length || report.baselines.some(item => !item.complete)) report.status = 'incomplete'
  else if (report.baselines.some(item => item.stableChanged)) report.status = 'review-required'
  return report
}

export function deliveryDecision(report, { changed, checksPassed, pendingFigures = [], existingPr = null }) {
  if (report.errors.length || report.status === 'error' || report.status === 'incomplete' || report.pending?.length || report.baselines.some(item => !item.complete)) return { action: 'blocked', reason: 'Evidence collection is incomplete; do not advance verification.' }
  if (!changed) return { action: 'report-only', reason: 'No substantive content change; do not create an empty commit or PR.' }
  if (!checksPassed || pendingFigures.length) return { action: 'draft-only', reason: 'Verification or figures are unfinished; do not claim completion.' }
  return existingPr ? { action: 'update-pr', branch, number: existingPr.number } : { action: 'create-pr', branch }
}

function getWorkspace() {
  const status = execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' }).trim()
  const currentBranch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim()
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim()
  const match = remote.match(/(?:github\.com[:/])([\w.-]+\/[\w.-]+?)(?:\.git)?$/)
  if (!match) throw new Error('Expected a GitHub origin. No push or configuration changes were made.')
  const repository = match[1]
  const prs = JSON.parse(execFileSync('gh', ['pr', 'list', '--repo', repository, '--head', branch, '--state', 'open', '--json', 'number,url,headRefName'], { cwd: root, encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'] }))
  return { dirty: Boolean(status), changedFiles: status ? status.split(/\r?\n/) : [], currentBranch, repository, existingPr: prs[0] || null, isolationRequired: Boolean(status) && currentBranch !== branch }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let workspace = {}, workspaceError
  try { workspace = getWorkspace() } catch (error) { workspaceError = String(error.message).slice(0, 1200) }
  const report = await collectReport({ catalog: readJson('content/chapters.json'), verification: readJson('content/verification.json'), workspace })
  if (workspaceError) { report.errors.push({ workspace: workspaceError }); report.status = 'error' }
  const directory = resolve(root, '.cache/sync')
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ status: report.status, report: '.cache/sync/report.json', repositories: report.baselines.map(item => ({ repository: item.repository, latest: item.latestTag, stableChanged: item.stableChanged, unreleased: item.unreleased.changed, complete: item.complete, affectedChapters: item.affectedChapters })), workspace: { dirty: workspace.dirty, isolationRequired: workspace.isolationRequired, existingPr: workspace.existingPr }, errors: report.errors }, null, 2))
  if (report.status === 'error' || report.status === 'incomplete') process.exitCode = 1
}
