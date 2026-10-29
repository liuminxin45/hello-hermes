import test from 'node:test'
import assert from 'node:assert/strict'
import { LEARNING_EXPERIMENTS, QUESTIONS } from '../docs/public/factory/content.mjs'
import { runBudgetExperiment, runRetrievalExperiment, runToolResultExperiment, runLearningExperiment } from '../docs/public/factory/learning-experiments.mjs'

test('a smaller window changes the plan for the same workload and still reserves the next tool result and output', () => {
  const wide = runBudgetExperiment('wide'), tight = runBudgetExperiment('tight')
  assert.deepEqual(wide.before, tight.before)
  assert.deepEqual(wide.reserve, tight.reserve)
  assert.equal(wide.strategy, 'keep-current')
  assert.deepEqual(wide.before, wide.after)
  assert.ok(wide.totalBefore <= wide.capacity)
  assert.ok(tight.totalBefore > tight.capacity)
  assert.equal(tight.strategy, 'summarize-middle')
  assert.ok(tight.totalAfter <= tight.capacity)
  assert.equal(tight.after.head, tight.before.head)
  assert.equal(tight.after.tail, tight.before.tail)
  assert.ok(tight.after.middle < tight.before.middle)
  assert.equal(tight.archiveUnits, wide.archiveUnits)
  assert.ok(tight.reserve.toolResult > 0 && tight.reserve.output > 0 && tight.reserve.margin > 0)
})

test('changing query wording can miss a relevant lexical candidate while the preset semantic side recalls an outdated candidate too', () => {
  const exact = runRetrievalExperiment('exact'), paraphrase = runRetrievalExperiment('paraphrase')
  assert.equal(exact.lexical.find(match => match.documentId === 'R1').hit, true)
  assert.equal(paraphrase.lexical.find(match => match.documentId === 'R1').hit, false)
  assert.equal(paraphrase.semantic.find(match => match.documentId === 'R1').hit, true)
  assert.equal(paraphrase.semantic.find(match => match.documentId === 'R4').hit, true)
  assert.match(paraphrase.documents.find(document => document.id === 'R4').version, /过时/)
  assert.equal(paraphrase.documents.find(document => document.id === 'R4').needsVerification, true)
  const missing = runRetrievalExperiment('missing')
  assert.ok(missing.lexical.every(match => !match.hit))
  assert.ok(missing.semantic.every(match => !match.hit))
  assert.match(missing.takeaway, /不应凭空/)
})

test('successful transport, current-version usability and whole-task completion are separate checks', () => {
  const wrong = runToolResultExperiment('wrong-version'), failed = runToolResultExperiment('failed'), correct = runToolResultExperiment('correct')
  assert.equal(wrong.request.sourceId, 'A3')
  assert.deepEqual(wrong.outcome.returnedSourceIds, ['A1'])
  assert.equal(wrong.outcome.ok, true)
  assert.equal(wrong.canVerifyCurrentChange, false)
  assert.equal(failed.outcome.ok, false)
  assert.deepEqual(failed.outcome.returnedSourceIds, [])
  assert.equal(failed.canVerifyCurrentChange, false)
  assert.deepEqual(correct.outcome.returnedSourceIds, ['A3'])
  assert.equal(correct.canVerifyCurrentChange, true)
  assert.match(correct.takeaway, /成稿/)
  assert.ok(!('draft' in correct) && !('score' in correct) && !('task' in correct))
})

test('controlled comparisons are deterministic, isolated from fixtures and reachable from their reviewed questions', () => {
  const snapshot = structuredClone(LEARNING_EXPERIMENTS)
  for (const experiment of LEARNING_EXPERIMENTS) {
    for (const questionId of experiment.questionIds) assert.equal(QUESTIONS.find(question => question.id === questionId).experimentId, experiment.id)
    for (const choice of experiment.choices) {
      const first = runLearningExperiment(experiment.id, choice.id)
      assert.deepEqual(first, runLearningExperiment(experiment.id, choice.id))
      assert.equal(first.teachingOnly, true)
      first.panels[0].lines.push('visitor-local-only')
      assert.ok(!runLearningExperiment(experiment.id, choice.id).panels[0].lines.includes('visitor-local-only'))
    }
  }
  assert.deepEqual(LEARNING_EXPERIMENTS, snapshot)
  assert.throws(() => runBudgetExperiment('not-a-budget'), /未知/)
  assert.throws(() => runLearningExperiment('not-an-experiment'), /未知/)
})
