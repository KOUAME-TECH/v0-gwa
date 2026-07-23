/** Filtre contenu feed peu utile / marketing démo. */

const SPAM_PATTERNS = [
  /aventure\s+gwa/i,
  /rejoindre\s+dans\s+l['']aventure/i,
  /qu['']est[- ]ce\s+que\s+vous\s+attendez/i,
  /celui\s+de\s+la\s+prosp[eé]rit/i,
]

/** Retourne true si le post doit être masqué du feed. */
export function isLowQualityPostContent(content?: string | null): boolean {
  const text = (content ?? "").trim()
  if (!text) return false
  return SPAM_PATTERNS.some((re) => re.test(text))
}
