/**
 * Yelly — assistante GWA, réponses courtes et ancrées métier.
 */
import { buildYellyDomainFacts } from "@/lib/yelly/knowledge"

export const YELLY_NAME = "Yelly"
export const YELLY_TAGLINE = "Aide GWA"

export const YELLY_SYSTEM_PROMPT = `Tu es Yelly, assistante GWA sur mobile (marketplace agri Côte d’Ivoire).

Règles de forme :
- Français simple, tutoiement, 2–3 phrases max.
- Zéro markdown, zéro listes à puces, zéro « En tant qu’IA ».
- Vocabulaire GWA : « argent protégé », « score de confiance », « avance sur vente », « nouveautés », « code SMS », « palier » (abo vendeur). Évite les sigles SCG / Digest / affacturage côté utilisateur.

Règles de fond :
- Utilise la FICHE GWA + le CONTEXTE utilisateur fournis. Ne contredis jamais leurs chiffres.
- Question argent / commande / abo / score / coop : donne le fait exact puis le prochain geste dans l’app (ex. Mes commandes, Publier, Profil → Vérification, /abonnement).
- Adapte au rôle du contexte (acheteur ≠ producteur ≠ coop).
- Si hors fiche ou doute : une phrase honnête + propose « Passer à quelqu’un » ou WhatsApp +225 07 88 32 60 19.
- Jamais mot de passe, code SMS, PIN Mobile Money, ni numéro de carte.
- Ne promets pas d’argent, de crédit, ni d’approbation.`

/** Prompt système complet = règles + fiche métier + contexte session. */
export function buildYellySystemPrompt(opts?: {
  locale?: string
  userContext?: string
  /** Override (ex. Yelly Ops backoffice). */
  systemPrompt?: string
  /** Contexte additionnel (admin task, etc.). */
  contextHint?: string
}): string {
  const base = (opts?.systemPrompt || YELLY_SYSTEM_PROMPT).trim()
  const parts = [base, "", buildYellyDomainFacts()]
  const ctx = [opts?.userContext, opts?.contextHint].filter(Boolean).join("\n")
  if (ctx) {
    parts.push("", "CONTEXTE UTILISATEUR / SESSION :", ctx)
  }
  if (opts?.locale && opts.locale !== "fr") {
    parts.push("", `Langue préférée utilisateur : ${opts.locale} (réponds en français simple sauf demande contraire).`)
  }
  return parts.join("\n")
}

export const YELLY_SUGGESTIONS = [
  "Je veux vendre",
  "C’est quoi les nouveautés ?",
  "Où est mon argent ?",
  "Parler à quelqu’un",
] as const

export const YELLY_SUGGESTIONS_BY_ROLE: Record<string, readonly string[]> = {
  acheteur: [
    "Où est ma commande ?",
    "Comment confirmer la réception ?",
    "Contacter un vendeur",
    "Explorer le marché",
  ],
  buyer: [
    "Où est ma commande ?",
    "Comment confirmer la réception ?",
    "Contacter un vendeur",
    "Explorer le marché",
  ],
  entreprise: [
    "Compte Enterprise / devis",
    "Acheter en volume",
    "Facture et paiement",
    "Parler à quelqu’un",
  ],
  business: [
    "Compte Enterprise / devis",
    "Acheter en volume",
    "Facture et paiement",
    "Parler à quelqu’un",
  ],
  producteur: [
    "Comment publier ?",
    "Commission de mon palier",
    "Monter mon score",
    "Demander une avance sur vente",
  ],
  farmer: [
    "Comment publier ?",
    "Commission de mon palier",
    "Monter mon score",
    "Demander une avance sur vente",
  ],
  transformateur: [
    "Comment publier ?",
    "Commission de mon palier",
    "Monter mon score",
    "Demander une avance sur vente",
  ],
  cooperative: [
    "Inviter 15 membres",
    "Docs légaux coop",
    "Catalogue des membres",
    "Qualification coop",
  ],
}

export function yellySuggestionsForRole(
  userType: string | null | undefined,
): readonly string[] {
  if (!userType) return YELLY_SUGGESTIONS
  return YELLY_SUGGESTIONS_BY_ROLE[userType] || YELLY_SUGGESTIONS
}

export const YELLY_WELCOME = "Salut, c’est Yelly. Tu veux vendre, acheter, ou autre chose ?"

export function yellyWelcomeForRole(userType: string | null | undefined): string {
  switch (userType) {
    case "acheteur":
    case "buyer":
      return "Salut, c’est Yelly. Tu cherches un produit, ou tu suis une commande ?"
    case "entreprise":
    case "business":
      return "Salut, c’est Yelly. Desk achats : volume, devis, ou une commande ?"
    case "producteur":
    case "farmer":
    case "transformateur":
      return "Salut, c’est Yelly. Publier, commandes, ou ton score de confiance ?"
    case "cooperative":
      return "Salut, c’est Yelly. Membres, qualification, ou catalogue coop ?"
    default:
      return YELLY_WELCOME
  }
}
