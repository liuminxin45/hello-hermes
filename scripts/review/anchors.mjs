export const normalize = text => text.replace(/\s+/gu, ' ').trim()

// Exact quote + section + context; never silently jump to an unrelated duplicate.
export function locateText(text, anchor, revision, sections = []) {
  const { quote, prefix = '', suffix = '' } = anchor
  if (!quote) return null
  const candidates = []
  for (let start = text.indexOf(quote); start >= 0; start = text.indexOf(quote, start + 1)) {
    const end = start + quote.length
    const section = sections.filter(s => s.start <= start).at(-1)
    if (anchor.sectionId && section?.id !== anchor.sectionId) continue
    const samePosition = revision === anchor.revision && start === anchor.start && end === anchor.end
    const before = prefix.slice(-24), after = suffix.slice(0, 24)
    const score = (before.length >= 4 && text.slice(Math.max(0, start - before.length), start) === before ? 1 : 0) + (after.length >= 4 && text.slice(end, end + after.length) === after ? 1 : 0)
    if (samePosition) return { start, end }
    if (score || (!prefix && !suffix && revision === anchor.revision)) candidates.push({ start, end, score })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates.length && (candidates.length === 1 || candidates[0].score > candidates[1].score) ? candidates[0] : null
}
