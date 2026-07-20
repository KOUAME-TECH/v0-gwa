/** Résumé cognitif — une phrase courte sous les ondes (dyslexie, charge mentale). */

export function buildCognitiveSummary(text?: string | null, maxLen = 72): string | null {
  const trimmed = (text ?? "").trim()
  if (!trimmed) return null

  const firstSentence = trimmed.split(/[.!?]\s+/)[0]?.trim() ?? trimmed
  if (firstSentence.length <= maxLen) return firstSentence

  const cut = firstSentence.slice(0, maxLen - 1).trim()
  const lastSpace = cut.lastIndexOf(" ")
  const base = lastSpace > 24 ? cut.slice(0, lastSpace) : cut
  return `${base}…`
}
