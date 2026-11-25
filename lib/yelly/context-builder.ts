/**
 * Construit le contexte envoyé au modèle : rôle, produit, historique du chat.
 * Tout passe par redactPiiForAi : aucune PII (e-mail, téléphone, adresse) ne sort.
 */
import { redactPiiForAi } from "@/lib/yelly/pii"
import {
  capabilityInstruction,
  detectAgreement,
  referencePriceRange,
  type ChatTurn,
  type YellyIntent,
} from "@/lib/yelly/capabilities"

export type YellyProductContext = {
  name: string
  price?: number | null
  unit?: string | null
  city?: string | null
  region?: string | null
  ocpvReference?: number | null
}

export type YellyContextInput = {
  role?: string | null
  product?: YellyProductContext | null
  history?: ChatTurn[]
  intent: YellyIntent
}

const ROLE_LABELS: Record<string, string> = {
  producteur: "producteur (vendeur)",
  farmer: "producteur (vendeur)",
  transformateur: "transformateur (vendeur)",
  cooperative: "coopérative (vendeur)",
  acheteur: "acheteur",
  buyer: "acheteur",
  entreprise: "entreprise (acheteur)",
  business: "entreprise (acheteur)",
}

export function roleLabel(role?: string | null): string {
  if (!role) return "visiteur"
  return ROLE_LABELS[role] || "membre"
}

export function buildYellyContext(input: YellyContextInput): string {
  const parts: string[] = [`Rôle de l’utilisateur : ${roleLabel(input.role)}`]
  const p = input.product
  if (p?.name) {
    const bits = [
      `Produit : ${redactPiiForAi(p.name, 80)}`,
      p.price ? `prix affiché ${p.price} FCFA/${redactPiiForAi(p.unit || "unité", 20)}` : null,
      p.city ? `ville ${redactPiiForAi(p.city, 60)}` : null,
      p.region ? `région ${redactPiiForAi(p.region, 60)}` : null,
    ].filter(Boolean)
    parts.push(bits.join(", "))
    const range = referencePriceRange({ listedPrice: p.price, ocpvReference: p.ocpvReference })
    if (range && input.intent === "reference_price") {
      parts.push(
        `Fourchette indicative calculée : ${range.low}–${range.high} FCFA (${range.basis === "ocpv" ? "prix de référence OCPV" : "prix affiché"} ±10 %)`,
      )
    }
  } else if (p?.city) {
    parts.push(`Ville : ${redactPiiForAi(p.city, 60)}`)
  }
  const history = (input.history || []).slice(-8)
  if (history.length) {
    const lines = history.map(
      (t) => `${t.author === "moi" ? "Moi" : "Autre partie"} : ${redactPiiForAi(t.text, 160)}`,
    )
    parts.push(`Derniers messages du chat :\n${lines.join("\n")}`)
    if (input.intent === "detect_agreement" || input.intent === "purchase_order") {
      const a = detectAgreement(history)
      parts.push(
        `Analyse automatique : ${a.agreed ? "accord probable" : "pas d’accord clair"}${a.amount ? ` (montant ${a.amount} FCFA)` : ""}, ${a.reason}.`,
      )
    }
  }
  const task = capabilityInstruction(input.intent)
  if (task) parts.push(task)
  return redactPiiForAi(parts.join("\n"), 1800)
}
