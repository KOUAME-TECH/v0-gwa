/**
 * Cache des questions fréquentes de Yelly : réponses validées, servies sans
 * appel à Gemini (coût 0, latence ~0). Plus un petit cache mémoire (TTL)
 * pour les réponses génériques déjà produites par le modèle.
 */

export type FaqEntry = { id: string; patterns: RegExp[]; answer: string }

export const YELLY_FAQ: FaqEntry[] = [
  {
    id: "payer",
    patterns: [/^comment (je )?(payer|paie|paye|r[ée]gler)/i, /^comment (on|je) paie/i, /^moyens? de paiement/i],
    answer:
      "Tu paies par mobile money via GeniusPay depuis ta commande. L’argent reste protégé par GWA jusqu’à ce que tu confirmes la réception.",
  },
  {
    id: "argent",
    patterns: [/^o[uù] est mon argent/i, /^quand (vais-je|je vais|est-ce que je vais) (être|etre) pay[ée]/i],
    answer:
      "L’argent est libéré au vendeur après ta confirmation de réception. Le suivi est dans Mes commandes.",
  },
  {
    id: "frais",
    patterns: [/^(quels sont )?(les )?frais/i, /^combien co[uû]te gwa/i, /^frais (acheteur|de service)/i],
    answer:
      "Pour l’acheteur, GWA prend 250 F par opération. Pour le vendeur, une commission selon son palier, de 9 % (Graine) à 7 % (Récolte).",
  },
  {
    id: "vendre",
    patterns: [/^(comment )?(je veux )?vendre\b/i, /^comment publier/i],
    answer: "Pour vendre : Publier, puis nom, prix, photos et ville. Ton offre est visible tout de suite.",
  },
  {
    id: "confirmer",
    patterns: [/^comment confirmer (la )?r[ée]ception/i],
    answer: "Ouvre ta commande dans Mes commandes et appuie sur Confirmer la réception quand tout est conforme.",
  },
]

export function normalizeQuestion(q: string): string {
  return (q || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function matchFaq(question: string): FaqEntry | null {
  const raw = (question || "").trim()
  if (!raw || raw.length > 120) return null
  return YELLY_FAQ.find((f) => f.patterns.some((re) => re.test(raw))) ?? null
}

type CacheItem = { reply: string; expiresAt: number }
const memory = new Map<string, CacheItem>()
const MAX_ITEMS = 200
export const YELLY_CACHE_TTL_MS = 60 * 60 * 1000

/** Clé de cache : seulement pour une question générique (sans contexte produit ni chat). */
export function genericCacheKey(question: string, page?: string): string {
  return `${page || "-"}|${normalizeQuestion(question)}`
}

export function readCachedReply(key: string, now = Date.now()): string | null {
  const hit = memory.get(key)
  if (!hit) return null
  if (hit.expiresAt <= now) {
    memory.delete(key)
    return null
  }
  return hit.reply
}

export function writeCachedReply(key: string, reply: string, now = Date.now()): void {
  if (memory.size >= MAX_ITEMS) {
    const oldest = memory.keys().next().value
    if (oldest) memory.delete(oldest)
  }
  memory.set(key, { reply, expiresAt: now + YELLY_CACHE_TTL_MS })
}

export function clearYellyCache(): void {
  memory.clear()
}
