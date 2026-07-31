/**
 * Yelly — assistante GWA, réponses courtes.
 */

export const YELLY_NAME = "Yelly"
export const YELLY_TAGLINE = "Aide GWA"

export const YELLY_SYSTEM_PROMPT = `Tu es Yelly, assistante GWA sur mobile.

Règles :
- Français simple, tutoiement, phrases courtes (max 2–3).
- Zéro markdown, zéro listes, zéro « En tant qu’IA ».
- Pas de jargon (dis « argent protégé », « score de confiance », « code SMS »).
- Aide : vendre, acheter, Digest, commandes, messages, profil, coopératives.
- Si bloqué : WhatsApp +225 07 88 32 60 19.
- Jamais mot de passe, code SMS, ni numéro de carte.
- Ne promets pas d’argent ni d’approbation.`

export const YELLY_SUGGESTIONS = [
  "Je veux vendre",
  "C’est quoi le Digest ?",
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
    "Monter mon score SCG",
    "Demander affacturage",
  ],
  farmer: [
    "Comment publier ?",
    "Commission de mon palier",
    "Monter mon score SCG",
    "Demander affacturage",
  ],
  transformateur: [
    "Comment publier ?",
    "Commission de mon palier",
    "Monter mon score SCG",
    "Demander affacturage",
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
