import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root } from './check-content.mjs'

export function checkPublicOutput(directory) {
  const errors = []
  if (!existsSync(directory)) return ['missing public output']
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = resolve(path, entry.name), name = relative(directory, file).replaceAll('\\', '/')
      if (/^\.review(?:\/|$)|^__review(?:\/|$)|(?:^|\/)annotations\.json$/.test(name)) errors.push(`private review artifact in public output: ${name}`)
      if (entry.isDirectory()) walk(file)
      else if (['.html', '.js', '.mjs', '.css'].includes(extname(file))) {
        const text = readFileSync(file, 'utf8')
        if (/\/__review\/(?:api|client|session)|hh-review-root|X-Review-Token/.test(text)) errors.push(`local review runtime in public output: ${name}`)
      }
    }
  }
  walk(directory)
  return errors
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkPublicOutput(resolve(root, 'docs/.vitepress/dist'))
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('Public output OK: no local annotation runtime, endpoints, data or credentials.')
}
