/**
 * Fiche métier GWA pour Yelly — faits stables alignés sur le code.
 * Source de vérité : lib/pricing/*, lib/orders/escrow-flow, lib/factoring, coop validation.
 */
import {
  FREE_MAX_ACTIVE_LISTINGS,
  SELLER_COMMISSION_RATES,
  SUBSCRIPTION_PRICES_FCFA,
  TIER_LABELS_FR,
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"
import { yellyDailyLimitForTier } from "@/lib/pricing/entitlements"
import { FACTORING_MIN_SCORE } from "@/lib/factoring/eligibility"
import {
  COOP_DOCS_DEADLINE_MONTHS,
  COOP_MEMBERS_DEADLINE_DAYS,
  COOP_MIN_ACTIVE_MEMBERS,
} from "@/lib/cooperatives/validation-policy"

function pctLabel(rate: number): string {
  const pct = rate * 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)} %`
}

function priceLabel(tier: SubscriptionTier): string {
  const p = SUBSCRIPTION_PRICES_FCFA[tier]
  if (p == null) return "devis"
  if (p === 0) return "0 FCFA"
  return `${p.toLocaleString("fr-FR")} FCFA / mois`
}

/** Seuil SCG / affacturage. */
export const YELLY_SCG_BANCABLE_THRESHOLD = FACTORING_MIN_SCORE
export const YELLY_SCG_MAX = 1000

/** Qualification coop. */
export const YELLY_COOP_MIN_MEMBERS = COOP_MIN_ACTIVE_MEMBERS
export const YELLY_COOP_MEMBER_WINDOW_DAYS = COOP_MEMBERS_DEADLINE_DAYS
export const YELLY_COOP_DOCS_MONTHS = COOP_DOCS_DEADLINE_MONTHS

/** Retrait portefeuille — défaut admin (platform_settings.min_withdrawal). */
export const YELLY_WALLET_MIN_WITHDRAWAL_FCFA = 1000

/** Support WhatsApp GWA (même numéro partout). */
export const YELLY_SUPPORT_WHATSAPP = "+225 07 88 32 60 19"

/** Faits structurés pour fallback mots-clés (pas de chiffres inventés). */
export type YellyDomainFacts = {
  commissionFreePct: string
  commissionStarterPct: string
  commissionProPct: string
  starterMonthlyFcfa: number
  proMonthlyFcfa: number
  freeMaxListings: number
  scgMax: number
  scgTrustThreshold: number
  factoringMinScg: number
  coopMinMembers: number
  coopPaymentDeadlineDays: number
  coopAdminValidationDays: number
  coopEngagementMonths: number
  walletMinWithdrawalFcfa: number
  supportWhatsapp: string
}

export function getYellyDomainFacts(): YellyDomainFacts {
  return {
    commissionFreePct: pctLabel(SELLER_COMMISSION_RATES.free),
    commissionStarterPct: pctLabel(SELLER_COMMISSION_RATES.starter),
    commissionProPct: pctLabel(SELLER_COMMISSION_RATES.pro),
    starterMonthlyFcfa: SUBSCRIPTION_PRICES_FCFA.starter ?? 0,
    proMonthlyFcfa: SUBSCRIPTION_PRICES_FCFA.pro ?? 0,
    freeMaxListings: FREE_MAX_ACTIVE_LISTINGS,
    scgMax: YELLY_SCG_MAX,
    scgTrustThreshold: YELLY_SCG_BANCABLE_THRESHOLD,
    factoringMinScg: FACTORING_MIN_SCORE,
    coopMinMembers: YELLY_COOP_MIN_MEMBERS,
    coopPaymentDeadlineDays: YELLY_COOP_MEMBER_WINDOW_DAYS,
    coopAdminValidationDays: YELLY_COOP_MEMBER_WINDOW_DAYS,
    coopEngagementMonths: YELLY_COOP_DOCS_MONTHS,
    walletMinWithdrawalFcfa: YELLY_WALLET_MIN_WITHDRAWAL_FCFA,
    supportWhatsapp: YELLY_SUPPORT_WHATSAPP,
  }
}

/**
 * Fiche produit injectée dans le system prompt.
 * Zéro marketing flou — uniquement des faits actionnables.
 */
export function buildYellyDomainFacts(): string {
  const tiers = (Object.keys(SELLER_COMMISSION_RATES) as SubscriptionTier[])
    .map(
      (t) =>
        `${TIER_LABELS_FR[t]} : abo ${priceLabel(t)}, commission vendeur ${pctLabel(SELLER_COMMISSION_RATES[t])}`,
    )
    .join(" · ")

  return `FICHE GWA (Côte d’Ivoire — marketplace agri PWA) — respecte ces faits, n’invente rien :

PRODUIT
- GWA = Business Unit de KOUAME Corporation. Escrow = argent protégé applicatif (FeexPay Mobile Money), jamais « banque escrow ».
- Rôles compte : acheteur, producteur, transformateur, cooperative, entreprise (desk achats). Affacturage n’est pas un rôle d’inscription.
- Espace producteur (hub unique) : /dashboard/farmer — sections Accueil · Ventes · Produits · Argent · Score. Bottom nav « Ventes » y mène. Publier = /publier (pas /dashboard/products/new). Mes ventes = /dashboard/commandes?tab=ventes.

ARGENT / COMMANDES
- Parcours : panier (1 vendeur à la fois) → commande → paiement Mobile Money (Orange/MTN/Moov/Wave via FeexPay) → fonds en « argent protégé » (held) → vendeur prépare/expédie → acheteur confirme réception → escrow released → vendeur reçoit le net (après commission).
- Litige = fonds gelés (frozen) jusqu’à décision. Suivi : Mes commandes / confirmation.
- Acheteur retail : 0 frais GWA. Commission prélevée côté vendeur selon palier.
- Retrait portefeuille : minimum ${YELLY_WALLET_MIN_WITHDRAWAL_FCFA.toLocaleString("fr-FR")} FCFA (modifiable admin) — uniquement fonds déjà libérés (escrow released).

ABONNEMENTS VENDEUR
- ${tiers}
- Gratuit : max ${FREE_MAX_ACTIVE_LISTINGS} annonces actives. Starter+ : plus d’annonces, Digest, stats selon palier.
- Activation abo : demande dans l’app puis validation ops (preuve WhatsApp) — pas de carte bancaire dans GWA.

SCORE DE CONFIANCE (SCG)
- Score 0–${YELLY_SCG_MAX}. Seuil bancable / affacturage ≈ ${YELLY_SCG_BANCABLE_THRESHOLD}.
- Monte avec profil complet, livraisons honorées, avis notés (1–5 liés à commande), moins de litiges.
- Commentaires produit sans note (rating 0) n’influencent pas le SCG.
- Affacturage : file semi-manuelle pour producteurs/coop éligibles — décaissement hors plateforme après validation.

COOPÉRATIVES
- Qualification : au moins ${YELLY_COOP_MIN_MEMBERS} membres actifs (fenêtre ${YELLY_COOP_MEMBER_WINDOW_DAYS} j) + documents légaux sous ${YELLY_COOP_DOCS_MONTHS} mois.
- Sinon : usage basique OK, fonctions avancées (ex. affacturage) restreintes. Rôles coop : admin / manager / member.

DIGEST / NOTIFS
- Digest Harmattan : nouveautés près de toi (Boutique → Écouter / notifications). Push = OneSignal. SMS OTP = Africa’s Talking (pas OneSignal).

OÙ ALLER DANS L’APP
- Vendre : Publier. Acheter : Boutique / Agriculture. Argent vendeur : Wallet. Score : /scg. Abo : /abonnement. Aide : /aide ou WhatsApp ${YELLY_SUPPORT_WHATSAPP}.

INTERDIT
- Inventer un taux, prix, délai ou garantie hors cette fiche.
- Demander / répéter mot de passe, code SMS, PIN Mobile Money.
- Promettre un crédit, une approbation bancaire ou un payout immédiat.`
}

/** Ligne contexte utilisateur pour le LLM (compacte). */
export function formatYellyUserContext(input: {
  userType?: string | null
  tier?: string | null
  city?: string | null
  scgScore?: number | null
  scgBancable?: boolean | null
  page?: string | null
  productHint?: string | null
  orderHint?: string | null
  coopHint?: string | null
  extra?: string | null
}): string {
  const tier = normalizeSubscriptionTier(input.tier)
  const commission = pctLabel(SELLER_COMMISSION_RATES[tier])
  const yellyLimit = yellyDailyLimitForTier(tier)
  const yellyLabel =
    yellyLimit == null ? "Yelly illimité (anti-abus)" : `Yelly ${yellyLimit}/j`

  const parts: string[] = []
  if (input.userType) parts.push(`Rôle: ${input.userType}`)
  parts.push(
    `Palier: ${TIER_LABELS_FR[tier]} (commission ${commission}, ${yellyLabel})`,
  )
  if (input.city) parts.push(`Ville: ${input.city}`)
  if (input.scgScore != null && Number.isFinite(Number(input.scgScore))) {
    const score = Math.round(Number(input.scgScore))
    const bancable =
      input.scgBancable === true || score >= YELLY_SCG_BANCABLE_THRESHOLD
    parts.push(
      `SCG: ${score}${bancable ? " (bancable)" : ` (seuil ${YELLY_SCG_BANCABLE_THRESHOLD})`}`,
    )
  }
  if (input.page) parts.push(`Page: ${input.page}`)
  if (input.productHint) parts.push(input.productHint)
  if (input.orderHint) parts.push(input.orderHint)
  if (input.coopHint) parts.push(input.coopHint)
  if (input.extra) parts.push(input.extra)

  return parts.join(" · ")
}

/** Commission % pour un palier (fallback mots-clés). */
export function yellyCommissionPctLabel(tier: string | null | undefined): string {
  return pctLabel(SELLER_COMMISSION_RATES[normalizeSubscriptionTier(tier)])
}

export function yellyAboPriceLabel(tier: string | null | undefined): string {
  return priceLabel(normalizeSubscriptionTier(tier))
}
