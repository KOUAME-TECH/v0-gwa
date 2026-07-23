/** Délai avant de pouvoir modifier un email/téléphone déjà lié. */
export const LINK_CHANGE_COOLDOWN_DAYS = 90

export type LinkCooldownResult = {
  allowed: boolean
  daysRemaining: number
  nextChangeAt: string | null
  linkedAt: string | null
}

export function getLinkCooldown(
  linkedAt: string | Date | null | undefined,
  cooldownDays = LINK_CHANGE_COOLDOWN_DAYS,
): LinkCooldownResult {
  if (!linkedAt) {
    return { allowed: true, daysRemaining: 0, nextChangeAt: null, linkedAt: null }
  }
  const start = linkedAt instanceof Date ? linkedAt : new Date(linkedAt)
  if (Number.isNaN(start.getTime())) {
    return { allowed: true, daysRemaining: 0, nextChangeAt: null, linkedAt: null }
  }
  const next = new Date(start.getTime() + cooldownDays * 24 * 60 * 60 * 1000)
  const now = Date.now()
  if (now >= next.getTime()) {
    return {
      allowed: true,
      daysRemaining: 0,
      nextChangeAt: next.toISOString(),
      linkedAt: start.toISOString(),
    }
  }
  const msLeft = next.getTime() - now
  const daysRemaining = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
  return {
    allowed: false,
    daysRemaining,
    nextChangeAt: next.toISOString(),
    linkedAt: start.toISOString(),
  }
}

export function linkCooldownMessage(kind: "email" | "téléphone", result: LinkCooldownResult): string {
  if (result.allowed) return ""
  return `Ce ${kind} est déjà lié. Vous pourrez le changer dans ${result.daysRemaining} jour${result.daysRemaining > 1 ? "s" : ""}.`
}
