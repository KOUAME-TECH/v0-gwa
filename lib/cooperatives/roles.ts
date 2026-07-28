/**
 * Rôles coopératifs GWA — multi-gestionnaires habilités.
 * Une coopérative n’est pas mono-compte : plusieurs personnes peuvent la gérer.
 */

export const COOP_MEMBER_ROLES = ["admin", "manager", "member"] as const
export type CoopMemberRole = (typeof COOP_MEMBER_ROLES)[number]

export const COOP_ROLE_LABELS: Record<CoopMemberRole, string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  member: "Membre",
}

/** Rôles autorisés à piloter la coop (hors membre simple). */
export const COOP_MANAGEMENT_ROLES: CoopMemberRole[] = ["admin", "manager"]

export function isCoopMemberRole(value: unknown): value is CoopMemberRole {
  return (
    typeof value === "string" &&
    (COOP_MEMBER_ROLES as readonly string[]).includes(value)
  )
}

export function isCoopManagerRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager"
}

/** Mettre à jour la fiche coop (nom, docs, vitrine…). */
export function canManageCoop(role: string | null | undefined): boolean {
  return isCoopManagerRole(role)
}

/**
 * Habiliter / retirer des gestionnaires.
 * Seuls les administrateurs (rôle admin) peuvent changer les rôles.
 */
export function canAssignCoopRoles(role: string | null | undefined): boolean {
  return role === "admin"
}

/** Inviter / retirer des membres simples. */
export function canInviteMembers(role: string | null | undefined): boolean {
  return isCoopManagerRole(role)
}

/**
 * Règles de transition de rôle.
 * - Un admin ne peut pas se rétrograder s’il est le dernier admin.
 * - Un manager ne peut pas s’auto-promouvoir admin.
 * - On ne crée pas d’admin via self-service hors promote par un admin existant.
 */
export function canChangeMemberRole(input: {
  actorRole: CoopMemberRole
  targetCurrentRole: CoopMemberRole
  targetNewRole: CoopMemberRole
  targetIsSelf: boolean
  adminCount: number
}): { ok: true } | { ok: false; error: string } {
  if (!canAssignCoopRoles(input.actorRole)) {
    return {
      ok: false,
      error: "Seul un administrateur de la coopérative peut modifier les rôles.",
    }
  }

  if (input.targetCurrentRole === input.targetNewRole) {
    return { ok: true }
  }

  // Empêcher de retirer le dernier administrateur
  if (
    input.targetCurrentRole === "admin" &&
    input.targetNewRole !== "admin" &&
    input.adminCount <= 1
  ) {
    return {
      ok: false,
      error: "Impossible de retirer le dernier administrateur de la coopérative.",
    }
  }

  if (input.targetIsSelf && input.targetNewRole !== "admin") {
    // Un admin peut se rétrograder seulement s’il reste ≥1 autre admin (déjà couvert)
  }

  return { ok: true }
}

export function roleBadgeLabel(role: string | null | undefined): string {
  if (isCoopMemberRole(role)) return COOP_ROLE_LABELS[role]
  return COOP_ROLE_LABELS.member
}
