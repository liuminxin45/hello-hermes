import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
export const publishedChapters = catalog => catalog.filter(chapter => chapter.status === 'published')

export function validateCatalog(catalog, verification, read = path => readFileSync(resolve(root, path), 'utf8'), exists = path => existsSync(resolve(root, path))) {
  const errors = [], ids = new Set(), slugs = new Set()
  for (const chapter of catalog) {
    if (ids.has(chapter.id) || slugs.has(chapter.slug)) errors.push(`duplicate chapter: ${chapter.id}`)
    ids.add(chapter.id); slugs.add(chapter.slug)
    if (!/^\d{2}$/.test(chapter.id) || !/^[a-z0-9-]+$/.test(chapter.slug)) errors.push(`invalid chapter identity: ${chapter.id}`)
    if (!['planned', 'draft', 'published'].includes(chapter.status)) errors.push(`invalid status: ${chapter.id}`)
    if (chapter.status !== 'published') continue
    const path = `docs/chapters/${chapter.slug}.md`
    if (!exists(path)) { errors.push(`missing chapter: ${path}`); continue }
    const text = read(path), record = verification.chapters?.[chapter.id]
    if (!chapter.publishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(chapter.publishedAt)) errors.push(`missing publication date: ${chapter.id}`)
    if (!record?.upstreams || !Object.keys(record.upstreams).length) errors.push(`missing verification: ${chapter.id}`)
    for (const source of Object.values(record?.upstreams || {})) {
      if (!/^[\w.-]+\/[\w.-]+$/.test(source.repository) || !/^[a-f0-9]{40}$/.test(source.commit) || !source.tag || !/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt) || !source.paths?.length) errors.push(`invalid evidence: ${chapter.id}`)
    }
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || ''
    const evidenceDisplay = frontmatter.match(/^evidenceDisplay:\s*(\S+)\s*$/m)?.[1] || 'public'
    if (!['public', 'internal'].includes(evidenceDisplay)) errors.push(`invalid evidence display: ${chapter.id}`)
    if (!text.includes('## 本章要点') || (text.match(/::: details/g) || []).length < 2) errors.push(`missing learning support: ${chapter.id}`)
    if (evidenceDisplay === 'internal') {
      if (!record?.reviewNotes || !exists(record.reviewNotes)) errors.push(`missing internal review notes: ${chapter.id}`)
      if (text.includes('<ChapterVerification') || text.includes('## 对照官方实现')) errors.push(`unexpected public evidence: ${chapter.id}`)
    } else {
      if (!text.includes('## 对照官方实现')) errors.push(`missing public evidence: ${chapter.id}`)
      if (!text.includes(`<ChapterVerification chapter="${chapter.id}"`)) errors.push(`missing rendered verification: ${chapter.id}`)
    }
    const images = [...text.matchAll(/<TeachingFigure\s+src="([^"]+)"[^>]+alt="([^"]+)"/g)]
    if (images.length < 2) errors.push(`expected at least two teaching figures: ${chapter.id}`)
    for (const [, src, alt] of images) {
      if (!src.startsWith('/images/') || !exists(`docs/public${src}`) || alt.length < 6) errors.push(`missing figure or alt: ${src}`)
      if (!verification.figures?.some(figure => figure.file === src && figure.reviewedAt && figure.promptId)) errors.push(`unreviewed figure: ${src}`)
    }
    if (record?.pending?.length) errors.push(`unfinished review: ${chapter.id}`)
  }
  return errors
}

export function checkLocalLinks() {
  const errors = []
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.name.startsWith('.') ? [] : entry.isDirectory() ? walk(resolve(dir, entry.name)) : entry.name.endsWith('.md') ? [resolve(dir, entry.name)] : []) }
  for (const file of walk(resolve(root, 'docs'))) {
    const text = readFileSync(file, 'utf8')
    for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(href)) continue
      const target = href.split('#')[0]
      if (!target) continue
      if (!existsSync(resolve(dirname(file), target))) errors.push(`broken local link: ${file} -> ${href}`)
    }
  }
  return errors
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = [...validateCatalog(readJson('content/chapters.json'), readJson('content/verification.json')), ...checkLocalLinks()]
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`Content OK: ${publishedChapters(readJson('content/chapters.json')).length} published chapters; evidence, learning support, figures and local links verified.`)
}
