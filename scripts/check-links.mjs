import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root } from './check-content.mjs'

function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.name.startsWith('.') ? [] : entry.isDirectory() ? walk(resolve(path, entry.name)) : entry.name.endsWith('.md') ? [resolve(path, entry.name)] : []) }
const urls = [...new Set(walk(resolve(root, 'docs')).flatMap(file => [...readFileSync(file, 'utf8').matchAll(/https?:\/\/[^\s<>"')]+/g)].map(match => match[0].replace(/[。，；、]+$/, ''))))]
const results = [], queue = [...urls]
async function worker() {
  while (queue.length) {
    const url = queue.shift()
    try {
      let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) })
      if ([403, 405].includes(response.status)) response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) })
      results.push({ url, status: response.status, result: response.ok ? 'ok' : [404, 410].includes(response.status) ? 'missing' : 'unavailable' })
      await response.body?.cancel()
    } catch (error) { results.push({ url, result: 'unavailable', error: error.message }) }
  }
}
await Promise.all(Array.from({ length: 5 }, worker))
mkdirSync(resolve(root, '.cache'), { recursive: true })
writeFileSync(resolve(root, '.cache/links.json'), JSON.stringify(results, null, 2))
const missing = results.filter(item => item.result === 'missing'), unavailable = results.filter(item => item.result === 'unavailable')
console.log(JSON.stringify({ checked: urls.length, missing, unavailable, report: '.cache/links.json' }, null, 2))
if (missing.length || unavailable.length) process.exitCode = 1
