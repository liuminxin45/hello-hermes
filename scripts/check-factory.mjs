import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const actionOutcomes = {
  'request-source': 'request-created',
  'verify-source': 'source-verified',
  'context-compare': 'context-compare',
  'deliver-and-save': 'experience-decision',
  'reuse-session': 'requirements-applied'
}
const text = value => typeof value === 'string' && value.trim().length > 0
const list = value => Array.isArray(value) ? value : []

// This projection is embedded in the course so exported reports work offline.
export function projectClaimInfo(claims) {
  return JSON.parse(JSON.stringify(Object.fromEntries(claims.map(claim => [claim.claimId, {
    type: claim.type,
    version: claim.version,
    source: list(claim.source).map(({ kind, url, tag, commit, path, scope }) => ({ kind, url, tag, commit, path, scope })),
    reviewedAt: claim.reviewedAt,
    reviewStatus: claim.reviewStatus,
    limits: claim.limits
  }]))))
}

export function validateFactory(course, inventory, catalog, { exists = existsSync, projectRoot = root } = {}) {
  const errors = []
  const chapters = list(course.CHAPTERS), questions = list(course.QUESTIONS)
  const quiz = list(course.QUIZ), reviewQuiz = list(course.REVIEW_QUIZ), extraQuiz = list(course.EXTRA_QUIZ)
  const objectives = list(course.CORE_OBJECTIVES), claims = list(inventory.claims), stations = list(course.STATIONS), experiments = list(course.LEARNING_EXPERIMENTS)
  const uniqueIds = (items, field, label) => {
    const ids = new Set()
    for (const item of items) {
      if (!text(item[field]) || ids.has(item[field])) errors.push(`factory ${label}: missing or duplicate ${field}: ${item[field]}`)
      ids.add(item[field])
    }
    return ids
  }
  const chapterIds = uniqueIds(chapters, 'id', 'chapter')
  const questionIds = uniqueIds(questions, 'id', 'question')
  const quizIds = uniqueIds([...quiz, ...reviewQuiz, ...extraQuiz], 'id', 'quiz')
  const objectiveIds = uniqueIds(objectives, 'id', 'objective')
  const claimIds = uniqueIds(claims, 'claimId', 'claim')
  const stationIds = uniqueIds(stations, 'id', 'station')
  const experimentIds = uniqueIds(experiments, 'id', 'controlled experiment')
  const checkRefs = (refs, known, label) => {
    for (const id of list(refs)) if (!known.has(id)) errors.push(`factory ${label}: unknown reference ${id}`)
  }
  if (chapters.length !== 5) errors.push('factory course: expected five observation chapters')
  if (quiz.length !== 6 || reviewQuiz.length !== 6) errors.push('factory quiz: expected six core questions and six equivalent review questions')
  if (course.SCENARIO_VERSION !== inventory.scenarioVersion) errors.push('factory scenario version differs from claim inventory')

  for (const chapter of chapters) {
    if (!stationIds.has(chapter.nodeId)) errors.push(`factory chapter ${chapter.id}: unknown node ${chapter.nodeId}`)
    if (actionOutcomes[chapter.action] !== chapter.outcome || !text(chapter.label)) errors.push(`factory chapter ${chapter.id}: main action needs its explicit outcome and label`)
    if (!list(chapter.lines).length || !list(chapter.afterLines).length) errors.push(`factory chapter ${chapter.id}: missing mainline explanation or result`)
    if (list(chapter.questions).length < 2) errors.push(`factory chapter ${chapter.id}: missing two first-level questions`)
    checkRefs(chapter.questions, questionIds, `chapter ${chapter.id} questions`)
    checkRefs(chapter.objectiveIds, objectiveIds, `chapter ${chapter.id} objectives`)
  }
  const mainlineObjectives = new Set(chapters.flatMap(chapter => list(chapter.objectiveIds)))
  const testedObjectives = new Set(quiz.flatMap(item => list(item.objectiveIds)))
  for (const objective of objectives) {
    if (!mainlineObjectives.has(objective.id) || !testedObjectives.has(objective.id)) errors.push(`factory objective ${objective.id}: missing mainline or core assessment coverage`)
    checkRefs(objective.chapterIds, chapterIds, `objective ${objective.id} chapters`)
  }
  for (const question of questions) {
    if (!['principle', 'hermes', 'boundary'].includes(question.category)) errors.push(`factory question ${question.id}: invalid category`)
    if (![question.q, question.answer, question.evidence, question.boundary, question.returnTo].every(text)) errors.push(`factory question ${question.id}: incomplete answer, evidence, boundary or task return`)
    if (!stationIds.has(question.visual?.node)) errors.push(`factory question ${question.id}: unknown visual node`)
    if (question.experimentId && !experimentIds.has(question.experimentId)) errors.push(`factory question ${question.id}: unknown controlled experiment ${question.experimentId}`)
    checkRefs(question.chapterIds, chapterIds, `question ${question.id} chapters`)
  }
  for (const experiment of experiments) {
    checkRefs(experiment.questionIds, questionIds, `experiment ${experiment.id} questions`)
    if (!text(experiment.notice) || !stationIds.has(experiment.nodeId) || !list(experiment.choices).some(choice => choice.id === experiment.defaultChoice)) errors.push(`factory experiment ${experiment.id}: missing scope notice, visual node or default choice`)
  }
  for (const item of [...quiz, ...reviewQuiz, ...extraQuiz]) {
    if (!text(item.question) || !text(item.explanation) || list(item.options).length < 2 || !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length) errors.push(`factory quiz ${item.id}: invalid question, options, answer or explanation`)
    if (!chapters[item.chapter]) errors.push(`factory quiz ${item.id}: unknown observation chapter`)
    checkRefs(item.objectiveIds, objectiveIds, `quiz ${item.id} objectives`)
    for (const id of list(item.objectiveIds)) if (!mainlineObjectives.has(id)) errors.push(`factory quiz ${item.id}: objective ${id} is not taught on the mainline`)
  }
  for (const objective of objectives) if (!reviewQuiz.some(item => list(item.objectiveIds).includes(objective.id))) errors.push(`factory objective ${objective.id}: missing equivalent review question`)

  const records = [...chapters, ...questions, ...quiz, ...reviewQuiz, ...extraQuiz, ...experiments, course.REFLECTION, course.BASELINE].filter(Boolean)
  const coreClaimIds = new Set([...chapters, ...quiz].flatMap(record => list(record.claimIds)))
  for (const record of records) checkRefs(record.claimIds, claimIds, `${record.id || record.name || 'record'} claims`)
  for (const claim of claims) {
    if (!['general', 'implementation', 'simulation'].includes(claim.type)) errors.push(`factory claim ${claim.claimId}: invalid type`)
    checkRefs(claim.chapterIds, chapterIds, `claim ${claim.claimId} chapters`)
    checkRefs(claim.questionIds, questionIds, `claim ${claim.claimId} questions`)
    checkRefs(claim.quizIds, quizIds, `claim ${claim.claimId} quizzes`)
    if (claim.type !== 'implementation') continue
    const versioned = text(claim.version?.tag) && /^[a-f0-9]{40}$/.test(claim.version?.commit || '')
    const sourced = list(claim.source).some(source => text(source.url || source.path) && text(source.kind) && text(source.scope))
    if (!versioned || !sourced) errors.push(`factory claim ${claim.claimId}: implementation needs a fixed version and scoped source`)
    if (coreClaimIds.has(claim.claimId) && !/^reviewed(?:-|$)/.test(claim.reviewStatus || '')) errors.push(`factory claim ${claim.claimId}: core implementation needs an explicit reviewed status`)
    if (claim.reviewedAt == null) {
      if (coreClaimIds.has(claim.claimId)) errors.push(`factory claim ${claim.claimId}: unreviewed implementation cannot enter the core route or core quiz`)
      else if (!/(pending|unverified|待核实)/i.test(claim.reviewStatus || '')) errors.push(`factory claim ${claim.claimId}: unreviewed extension must be explicitly marked pending`)
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.reviewedAt)) errors.push(`factory claim ${claim.claimId}: invalid review date`)
  }
  if (JSON.stringify(course.CLAIM_INFO) !== JSON.stringify(projectClaimInfo(claims))) errors.push('factory report claim metadata differs from claims.json; regenerate CLAIM_INFO')

  const publishedPaths = new Set(list(catalog).filter(chapter => chapter.status === 'published').map(chapter => chapter.path || `chapters/${chapter.slug}`))
  for (const record of [...objectives, ...records]) {
    if (record.nextReading == null) continue
    const url = record.nextReading.split('#')[0]
    const page = url.replace(/^\/hello-hermes\//, '').replace(/\.html$/, '')
    if (!url.startsWith('/hello-hermes/') || !publishedPaths.has(page) || !exists(resolve(projectRoot, 'docs', `${page}.md`))) errors.push(`factory ${record.id}: nextReading is not an existing published local page: ${record.nextReading}`)
  }
  return errors
}

export async function checkFactory(projectRoot = root) {
  try {
    const course = await import(pathToFileURL(resolve(projectRoot, 'docs/public/factory/content.mjs')).href)
    const inventory = JSON.parse(readFileSync(resolve(projectRoot, 'docs/public/factory/claims.json'), 'utf8'))
    const catalog = JSON.parse(readFileSync(resolve(projectRoot, 'content/chapters.json'), 'utf8'))
    return validateFactory(course, inventory, catalog, { projectRoot })
  } catch (error) {
    return [`factory content could not be checked: ${error.message}`]
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkFactory()
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('Factory content OK: five chapters, six core objectives, question references, fixed-version claims and local reading links verified.')
}
