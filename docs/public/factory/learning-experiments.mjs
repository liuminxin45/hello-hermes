import { LEARNING_EXPERIMENTS } from './content.mjs'

const clone = value => structuredClone(value)
function experiment(id, choice) {
  const item = LEARNING_EXPERIMENTS.find(candidate => candidate.id === id)
  if (!item) throw new RangeError(`未知教学对照：${id}`)
  const selected = choice ?? item.defaultChoice
  if (!item.choices.some(candidate => candidate.id === selected)) throw new RangeError(`未知对照选项：${selected}`)
  return { item: clone(item), selected }
}
function result(item, selected, details) {
  return { id: item.id, title: item.title, notice: item.notice, nodeId: item.nodeId,
    claimIds: item.claimIds, choices: item.choices, selected, teachingOnly: true, ...details }
}

export function runBudgetExperiment(choice) {
  const { item, selected } = experiment('context-budget', choice), data = item.data
  const capacity = data.capacities[selected]
  const before = { ...data.current }, reserve = { ...data.reserve }
  const sum = values => Object.values(values).reduce((total, value) => total + value, 0)
  const inputBefore = sum(before), reservedUnits = sum(reserve)
  const mustSummarize = inputBefore + reservedUnits > capacity
  const after = { ...before, middle: mustSummarize ? data.compressedMiddle : before.middle }
  const inputAfter = sum(after), freeAfterPlan = capacity - inputAfter - reservedUnits
  return result(item, selected, {
    capacity, before, after, reserve, inputBefore, inputAfter, reservedUnits,
    totalBefore: inputBefore + reservedUnits, totalAfter: inputAfter + reservedUnits,
    archiveUnits: inputBefore, freeAfterPlan,
    strategy: mustSummarize ? 'summarize-middle' : 'keep-current',
    panels: [
      { title: '同一批材料与下一步', status: mustSummarize ? 'over-budget' : 'fits', lines: [
        `当前输入${inputBefore}格：前段${before.head}、中段${before.middle}、尾部${before.tail}。`,
        `下一步还要预留${reservedUnits}格：工具回执${reserve.toolResult}、输出${reserve.output}、估算余量${reserve.margin}。`,
        `合计${inputBefore + reservedUnits}格；当前容量${capacity}格。`
      ] },
      { title: mustSummarize ? '空间变小，先调整当前输入' : '空间够用，保留当前输入', status: mustSummarize ? 'summarized' : 'unchanged', lines: [
        mustSummarize ? `本次保护前段${after.head}格与尾部${after.tail}格；中段从${before.middle}格缩为${after.middle}格。` : '这次无需为了展示压缩而强行整理。',
        `输入与预留合计${inputAfter + reservedUnits}格，还剩${freeAfterPlan}格计划余量。`,
        `完整档案仍保留原来的${inputBefore}格；整理的是这轮带入的资料。`
      ] }
    ],
    takeaway: data.explanation,
    boundary: '保护首尾和具体格数只属于本次演示策略。摘要有损，不能因压缩后能装下就认定信息完整。'
  })
}

export function runRetrievalExperiment(choice) {
  const { item, selected } = experiment('retrieval-match', choice), data = item.data
  const query = data.queries.find(candidate => candidate.id === selected)
  const terms = query.terms.map(term => term.toLowerCase())
  const lexical = data.documents.map(document => {
    const index = new Set(document.terms.map(term => term.toLowerCase()))
    const missingTerms = terms.filter(term => !index.has(term))
    return { documentId: document.id, hit: missingTerms.length === 0, missingTerms,
      reason: missingTerms.length ? `未命中：词项表缺少${missingTerms.join('、')}。` : '命中：所有查询词项都在词项表中。' }
  })
  const semantic = data.documents.map(document => {
    const score = query.semanticScores[document.id], hit = score >= data.semanticThreshold
    return { documentId: document.id, hit, score, reason: `${hit ? '命中' : '未命中'}：预编相似分数${score.toFixed(2)}${hit ? '达到' : '未达到'}演示线${data.semanticThreshold}。` }
  })
  const line = match => {
    const document = data.documents.find(candidate => candidate.id === match.documentId)
    return `${match.hit ? '✓ 候选' : '○ 未入选'} ${document.id} ${document.title}（${document.version}）— ${match.reason}`
  }
  return result(item, selected, {
    query: query.text, documents: data.documents, lexical, semantic,
    lexicalRule: data.lexicalRule, semanticRule: data.semanticRule,
    panels: [
      { title: '简化词法匹配', status: lexical.some(match => match.hit) ? 'candidates' : 'no-match', lines: lexical.map(line) },
      { title: '预编语义相关候选', status: semantic.some(match => match.hit) ? 'candidates' : 'no-match', lines: semantic.map(line) }
    ],
    takeaway: query.explanation,
    boundary: '命中只产生候选。仍需查看原文、版本、来源及适用范围；未命中也不能证明现实中没有这份资料。'
  })
}

export function runToolResultExperiment(choice) {
  const { item, selected } = experiment('tool-result-boundary', choice), data = item.data
  const outcome = data.outcomes[selected]
  return result(item, selected, {
    request: data.request, outcome,
    canVerifyCurrentChange: outcome.ok && outcome.usable,
    panels: [
      { title: `相同请求：读取${data.request.sourceId}`, status: 'requested', lines: [data.request.purpose, '提出读取请求，不代表已经得到原文。'] },
      { title: outcome.title, status: outcome.status, lines: [
        `请求是否执行成功 ok=${outcome.ok}；能否用于本次核查 usable=${outcome.usable}。`,
        `返回来源：${outcome.returnedSourceIds.join('、') || '无'}。`, outcome.text
      ] }
    ],
    takeaway: outcome.next,
    boundary: '这是独立教学回执。切换选项不会向实际委托写入证据、重复执行工具或修改分数。'
  })
}

export function runLearningExperiment(id, choice) {
  if (id === 'context-budget') return runBudgetExperiment(choice)
  if (id === 'retrieval-match') return runRetrievalExperiment(choice)
  if (id === 'tool-result-boundary') return runToolResultExperiment(choice)
  throw new RangeError(`未知教学对照：${id}`)
}
