/**
 * Entitlements abo vendeur — chaque bénéfice affiché DOIT être rendu ici.
 * Source : décision DG 28/07/2026 + promesse BP.
 */
import {
  FREE_MAX_ACTIVE_LISTINGS,
  normalizeSubscriptionTier,
  SELLER_COMMISSION_RATES,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"

export type SellerEntitlements = {
  tier: SubscriptionTier
  /** null = illimité */
  maxActiveListings: number | null
  commissionRate: number
  /** Digest Harmattan / local */
  digestLocal: boolean
  /** SCG de base (score + coach) */
  scgBasic: boolean
  /** Dimensions SCG détaillées + coach avancé */
  scgAdvanced: boolean
  /** Badge « Pro GWA » sur vitrine */
  proBadge: boolean
  /** Score de boost catalogue (0 = aucun) */
  boostScore: number
  /** Priorité relative feed / boutique (plus haut = plus visible) */
  feedPriority: number
  /** Stats vendeur (CA, commandes, conversion) */
  simpleStats: boolean
  /** Priorité file affacturage (plus haut = traité avant) */
  factoringPriority: number
  /** Multi-gestionnaires (Enterprise / coop structurée) */
  multiManagers: boolean
  /** Reporting étendu (export / période) */
  reporting: boolean
  /** Account manager humain (process ops WhatsApp) */
  accountManager: boolean
  /**
   * Plafond requêtes Yelly (messages user) / jour calendaire (Africa/Abidjan).
   * null = illimité (rate-limit anti-abus IP reste actif).
   * Invité non connecté : 3 / 24h (hors entitlements — voir `/api/yelly/chat`).
   */
  yellyRequestsPerDay: number | null
}

/** Invité non connecté — cookie 24h, pas un palier abo */
export const YELLY_GUEST_MAX_PER_DAY = 3

const ENTITLEMENTS: Record<SubscriptionTier, Omit<SellerEntitlements, "tier" | "commissionRate">> = {
  free: {
    maxActiveListings: FREE_MAX_ACTIVE_LISTINGS,
    digestLocal: true,
    scgBasic: true,
    scgAdvanced: false,
    proBadge: false,
    boostScore: 0,
    feedPriority: 0,
    simpleStats: false,
    factoringPriority: 0,
    multiManagers: false,
    reporting: false,
    accountManager: false,
    yellyRequestsPerDay: 10,
  },
  starter: {
    maxActiveListings: null,
    digestLocal: true,
    scgBasic: true,
    scgAdvanced: false,
    proBadge: false,
    boostScore: 10,
    feedPriority: 10,
    simpleStats: true,
    factoringPriority: 10,
    multiManagers: false,
    reporting: false,
    accountManager: false,
    yellyRequestsPerDay: 40,
  },
  pro: {
    maxActiveListings: null,
    digestLocal: true,
    scgBasic: true,
    scgAdvanced: true,
    proBadge: true,
    boostScore: 30,
    feedPriority: 50,
    simpleStats: true,
    factoringPriority: 100,
    multiManagers: false,
    reporting: true,
    accountManager: false,
    yellyRequestsPerDay: 120,
  },
  enterprise: {
    maxActiveListings: null,
    digestLocal: true,
    scgBasic: true,
    scgAdvanced: true,
    proBadge: true,
    boostScore: 40,
    feedPriority: 80,
    simpleStats: true,
    factoringPriority: 150,
    multiManagers: true,
    reporting: true,
    accountManager: true,
    yellyRequestsPerDay: null,
  },
}

export function entitlementsForTier(
  raw: string | null | undefined,
): SellerEntitlements {
  const tier = normalizeSubscriptionTier(raw)
  return {
    tier,
    commissionRate: SELLER_COMMISSION_RATES[tier],
    ...ENTITLEMENTS[tier],
  }
}

export function canPublishAnotherListing(
  tier: string | null | undefined,
  activeCount: number,
): { ok: boolean; max: number | null; code?: string; message?: string } {
  const e = entitlementsForTier(tier)
  if (e.maxActiveListings == null) return { ok: true, max: null }
  if (activeCount >= e.maxActiveListings) {
    return {
      ok: false,
      max: e.maxActiveListings,
      code: "FREE_LISTING_LIMIT",
      message: `Palier Gratuit : maximum ${e.maxActiveListings} annonces actives. Passe en Starter pour en publier plus.`,
    }
  }
  return { ok: true, max: e.maxActiveListings }
}

export function canAccessSellerStats(tier: string | null | undefined): boolean {
  return entitlementsForTier(tier).simpleStats
}

export function canAccessAdvancedScg(tier: string | null | undefined): boolean {
  return entitlementsForTier(tier).scgAdvanced
}

export function canAccessReporting(tier: string | null | undefined): boolean {
  return entitlementsForTier(tier).reporting
}

export function hasProBadge(tier: string | null | undefined): boolean {
  return entitlementsForTier(tier).proBadge
}

export function factoringQueuePriority(tier: string | null | undefined): number {
  return entitlementsForTier(tier).factoringPriority
}

export function feedPriorityForTier(tier: string | null | undefined): number {
  return entitlementsForTier(tier).feedPriority
}

/** null = illimité */
export function yellyDailyLimitForTier(
  tier: string | null | undefined,
): number | null {
  return entitlementsForTier(tier).yellyRequestsPerDay
}

/**
 * Vérifie le quota journalier Yelly pour un palier.
 * `usedToday` = nb de messages rôle user déjà comptés aujourd’hui.
 */
export function canUseYellyToday(
  tier: string | null | undefined,
  usedToday: number,
): {
  ok: boolean
  limit: number | null
  remaining: number | null
  code?: string
  message?: string
} {
  const limit = yellyDailyLimitForTier(tier)
  if (limit == null) {
    return { ok: true, limit: null, remaining: null }
  }
  const used = Math.max(0, Math.floor(usedToday))
  if (used >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      code: "YELLY_DAILY_LIMIT",
      message: `Limite Yelly atteinte (${limit}/jour pour ton palier). Reviens demain, ou passe à un abo supérieur.`,
    }
  }
  return { ok: true, limit, remaining: limit - used }
}

/**
 * Tri stable : priorité abo DESC, puis created_at DESC.
 */
export function sortByFeedPriority<
  T extends { created_at?: string | null; feedPriority?: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = a.feedPriority ?? 0
    const pb = b.feedPriority ?? 0
    if (pb !== pa) return pb - pa
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })
}
