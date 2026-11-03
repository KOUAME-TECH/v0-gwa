/** Filtre contenu feed peu utile / marketing démo / données test. */

const SPAM_PATTERNS = [
  /aventure\s+gwa/i,
  /rejoindre\s+dans\s+l['']aventure/i,
  /qu['']est[- ]ce\s+que\s+vous\s+attendez/i,
  /celui\s+de\s+la\s+prosp[eé]rit/i,
  /comment\s+vendre\s+mieux/i,
  /premier\s+sur\s+gwa/i,
  /\b(lorem\s+ipsum|test\s*product|demo\s*post)\b/i,
]

/** Retourne true si le post doit être masqué du feed. */
export function isLowQualityPostContent(content?: string | null): boolean {
  const text = (content ?? "").trim()
  // Posts média sans légende = bruit UX / SEO
  if (!text) return true
  return SPAM_PATTERNS.some((re) => re.test(text))
}
