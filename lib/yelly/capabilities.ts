/**
 * Capacités métier de Yelly (Phase 2, directive t127u) :
 * prix de référence, reformulation d’offre, détection d’accord, bon de commande.
 * Fonctions pures : testables sans réseau ni Gemini.
 */

export type YellyIntent =
  | "reference_price"
  | "rephrase_offer"
  | "detect_agreement"
  | "purchase_order"
  | "general"

const INTENT_PATTERNS: { intent: YellyIntent; re: RegExp }[] = [
  { intent: "purchase_order", re: /bon de commande|bon d.achat|r[ée]dige.*commande|g[ée]n[èe]re.*commande/i },
  { intent: "detect_agreement", re: /accord|on est d.accord|conclu|march[ée] conclu|deal|on s.entend/i },
  { intent: "rephrase_offer", re: /reformul|r[ée][ée]cri|am[ée]liore (mon|l.)?\s*(offre|annonce|message)|tourne (mieux|autrement)/i },
  { intent: "reference_price", re: /prix (de )?r[ée]f[ée]rence|bon prix|juste prix|prix juste|prix correct|proposer combien|je (peux|dois) (proposer|offrir) combien|combien (vaut|co[uû]te)|prix du march[ée]|trop cher|prix moyen/i },
]

export function detectYellyIntent(message: string): YellyIntent {
  const m = message || ""
  for (const { intent, re } of INTENT_PATTERNS) {
    if (re.test(m)) return intent
  }
  return "general"
}

/** Consigne ajoutée au prompt système selon l’intention détectée. */
export function capabilityInstruction(intent: YellyIntent): string | null {
  switch (intent) {
    case "reference_price":
      return "Tâche : donne une fourchette de prix de référence en FCFA par unité, à partir du contexte (prix affiché, prix de référence OCPV s’il existe, ville). Dis clairement que c’est indicatif."
    case "rephrase_offer":
      return "Tâche : reformule l’offre en 2 phrases claires et polies (produit, quantité, prix FCFA, livraison). Ne change aucun chiffre."
    case "detect_agreement":
      return "Tâche : dis si les deux parties semblent d’accord (prix, quantité, livraison). Si oui, résume l’accord en une phrase et propose de créer le bon de commande. Si non, dis ce qui reste à régler."
    case "purchase_order":
      return "Tâche : prépare un brouillon de bon de commande en texte court : produit, quantité, prix unitaire FCFA, total, lieu de livraison (ville seulement), paiement protégé GWA. Rappelle que le bon officiel se crée avec le bouton Offre puis Accepter."
    default:
      return null
  }
}

export type ChatTurn = {
  /** "moi" = l’utilisateur qui demande, "autre" = l’autre partie */
  author: "moi" | "autre"
  text: string
  /** Montant d’une offre structurée (message_type = offer), si connu */
  offerAmount?: number
  offerStatus?: string
}

const ACCEPT_RE = /\b(d.accord|ok|okay|c.est bon|marché conclu|j.accepte|accept[ée]|vendu|deal|parfait|ça marche|ca marche)\b/i
const AMOUNT_RE = /(\d[\d\s.]{2,})\s*(?:f\b|fcfa|francs?|cfa|xof)/i

export function extractAmount(text: string): number | null {
  const m = AMOUNT_RE.exec(text || "")
  if (!m) return null
  const n = Number(m[1].replace(/[\s.]/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

export type AgreementResult = {
  agreed: boolean
  amount: number | null
  reason: string
}

/**
 * Détection d’accord déterministe (sans IA) sur les 10 derniers échanges :
 * une offre acceptée, ou un montant cité puis une acceptation de l’autre partie.
 */
export function detectAgreement(turns: ChatTurn[]): AgreementResult {
  const recent = turns.slice(-10)
  const accepted = [...recent].reverse().find((t) => t.offerStatus === "accepted" && t.offerAmount)
  if (accepted?.offerAmount) {
    return { agreed: true, amount: accepted.offerAmount, reason: "offre acceptée" }
  }
  let lastAmount: { amount: number; author: ChatTurn["author"] } | null = null
  for (const t of recent) {
    const amount = t.offerAmount ?? extractAmount(t.text)
    if (amount) lastAmount = { amount, author: t.author }
    else if (lastAmount && t.author !== lastAmount.author && ACCEPT_RE.test(t.text)) {
      return { agreed: true, amount: lastAmount.amount, reason: "montant accepté par l’autre partie" }
    }
  }
  return {
    agreed: false,
    amount: lastAmount?.amount ?? null,
    reason: lastAmount ? "montant proposé, pas encore accepté" : "aucun montant proposé",
  }
}

/** Fourchette indicative ±10 % autour du prix de référence OCPV, sinon du prix affiché. */
export function referencePriceRange(input: {
  listedPrice?: number | null
  ocpvReference?: number | null
}): { low: number; high: number; basis: "ocpv" | "listed" } | null {
  const base = input.ocpvReference && input.ocpvReference > 0 ? input.ocpvReference : input.listedPrice
  if (!base || base <= 0) return null
  const round = (n: number) => Math.round(n / 5) * 5
  return {
    low: round(base * 0.9),
    high: round(base * 1.1),
    basis: input.ocpvReference && input.ocpvReference > 0 ? "ocpv" : "listed",
  }
}

/**
 * Réponse déterministe quand le modèle est indisponible (repli) :
 * on garde les capacités utiles sans inventer de chiffre.
 */
export function deterministicCapabilityReply(
  intent: YellyIntent,
  product: { name?: string | null; price?: number | null; unit?: string | null; ocpvReference?: number | null } | null,
  history: ChatTurn[] = [],
): string | null {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f|\u00a0/g, " ")
  const unit = product?.unit ? `/${product.unit}` : ""
  if (intent === "reference_price" && product) {
    const r = referencePriceRange({ listedPrice: product.price, ocpvReference: product.ocpvReference })
    if (!r) return null
    const basis = r.basis === "ocpv" ? "prix de référence OCPV" : "prix affiché"
    return `Repère indicatif pour ${product.name || "ce produit"} : entre ${fmt(r.low)} et ${fmt(r.high)} FCFA${unit} (±10 % autour du ${basis}). Ce n’est qu’un repère : négocie selon la qualité et la quantité.`
  }
  if ((intent === "detect_agreement" || intent === "purchase_order") && history.length > 0) {
    const a = detectAgreement(history)
    if (a.agreed && a.amount) {
      return `Accord détecté à ${fmt(a.amount)} FCFA${unit}. Pour le bon de commande officiel : bouton Offre, puis Accepter. Le paiement reste protégé par GWA jusqu’à la livraison.`
    }
    return "Pas encore d’accord clair sur le prix. Fais une offre avec le bouton Offre pour fixer le montant."
  }
  return null
}
