/**
 * Bannière temporaire — renforcement mots de passe (HaveIBeenPwned).
 * Affichée ~7 jours après activation (cookie dismiss + fenêtre de date).
 * Toggle Supabase Dashboard : Authentication → Password security → Leaked password protection ON.
 */

export const HIBP_BANNER_MESSAGE =
  "Pour protéger votre compte et vos transactions, GWA refuse désormais les mots de passe déjà compromis. Choisissez un mot de passe unique d’au moins 8 caractères."

/** Fin d’affichage de la campagne (UTC). Ajuster si la campagne est relancée. */
export const HIBP_CAMPAIGN_ENDS_AT = new Date("2026-09-01T23:59:59.000Z")

export const HIBP_DISMISS_COOKIE = "gwa_hibp_banner_dismissed"

export function shouldShowHibpBanner(
  now: Date = new Date(),
  dismissed: boolean = false,
): boolean {
  if (dismissed) return false
  return now.getTime() <= HIBP_CAMPAIGN_ENDS_AT.getTime()
}
