/**
 * Conseil IA dans le chat — participant neutre (Mission 2).
 * Préfixe stable pour bulles « Conseil » (voir lib/chat/roles).
 */

export const AI_ADVICE_PREFIX = "[Conseil IA]"

export function formatAiAdviceMessage(reply: string): string {
  const body = (reply || "").trim()
  if (!body) return `${AI_ADVICE_PREFIX}\nJe n’ai pas de réponse pour l’instant. Réessaie.`
  if (/^\s*\[conseil\s*ia\]/i.test(body)) return body
  return `${AI_ADVICE_PREFIX}\n${body}`
}

export function stripAiAdvicePrefix(content: string): string {
  return (content || "").replace(/^\s*\[conseil\s*ia\]\s*/i, "").trim()
}

export function buildAiAdviceUserPrompt(question: string): string {
  const q = question.trim() || "Comment bien négocier sur GWA ?"
  return [
    "Tu es un conseiller neutre dans une discussion acheteur–vendeur sur GWA (Côte d’Ivoire).",
    "Ne prends pas parti. Donne des pistes concrètes, courtes et complètes.",
    "Pas de jargon technique. Montants en FCFA si tu en cites.",
    `Question : ${q}`,
  ].join("\n")
}
