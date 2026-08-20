/**
 * Tier abo effectif — expiration 30j appliquée (CGU Art. 7).
 */
import {
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"
import { entitlementsForTier, type SellerEntitlements } from "@/lib/pricing/entitlements"

export function effectiveSubscriptionTier(
  tier: string | null | undefined,
  expiresAt?: string | Date | null,
  now = new Date(),
): SubscriptionTier {
  const base = normalizeSubscriptionTier(tier)
  if (base === "free") return "free"
  if (!expiresAt) {
    // Colonne absente / jamais posée : on conserve le palier (ops doit poser expires).
    // En prod post-migration, activate pose toujours expires_at.
    return base
  }
  const exp =
    typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt
  if (!Number.isFinite(exp.getTime())) return base
  if (exp.getTime() < now.getTime()) return "free"
  return base
}

export function entitlementsForProfile(profile: {
  subscription_tier?: string | null
  subscription_expires_at?: string | Date | null
}): SellerEntitlements {
  const tier = effectiveSubscriptionTier(
    profile.subscription_tier,
    profile.subscription_expires_at ?? null,
  )
  return entitlementsForTier(tier)
}
