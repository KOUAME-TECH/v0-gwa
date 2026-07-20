import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  type AdminAction,
  type AdminRole,
  canPerformAdminAction,
  isAdminRole,
  isSuperAdmin,
} from "@/lib/auth/admin-permissions"

/** Session utilisateur requise — API routes */
export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, supabase, error: "Non authentifié" as const }
  }
  return { user, supabase, error: null }
}

/** Admin actif requis — utilise service role pour lecture fiable des rôles */
export async function requireAdmin() {
  const base = await requireUser()
  if (!base.user) return { ...base, isAdmin: false as const }

  const admin = createAdminClient()
  const { data: role } = await admin
    .from("admin_roles")
    .select("id, role, is_active")
    .eq("user_id", base.user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!role) {
    return {
      user: base.user,
      supabase: base.supabase,
      error: "Accès admin refusé" as const,
      isAdmin: false as const,
    }
  }

  const adminRole = isAdminRole(role.role) ? role.role : ("admin" as AdminRole)

  return {
    user: base.user,
    supabase: base.supabase,
    admin,
    role: { ...role, role: adminRole },
    error: null,
    isAdmin: true as const,
  }
}

/** super_admin uniquement — promotion / révocation de rôles admin */
export async function requireSuperAdmin() {
  const gate = await requireAdmin()
  if (!gate.isAdmin) return gate

  if (!isSuperAdmin(gate.role.role)) {
    return {
      ...gate,
      isAdmin: false as const,
      error: "Super administrateur requis" as const,
    }
  }

  return gate
}

/** Vérifie qu'une action admin est autorisée pour le rôle courant */
export async function requireAdminAction(action: AdminAction) {
  const gate = await requireAdmin()
  if (!gate.isAdmin) return gate

  if (!canPerformAdminAction(gate.role.role, action)) {
    return {
      ...gate,
      isAdmin: false as const,
      error: "Action non autorisée pour votre rôle" as const,
    }
  }

  return gate
}

/**
 * Partenaire financier actif (post-bêta UI).
 * Lecture partner_roles via service role — tables créées en migration 036.
 */
export async function requirePartner() {
  const base = await requireUser()
  if (!base.user) {
    return { ...base, isPartner: false as const, partner: null }
  }

  const admin = createAdminClient()
  const { data: role, error } = await admin
    .from("partner_roles")
    .select("id, role, organization_id, is_active")
    .eq("user_id", base.user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !role) {
    return {
      user: base.user,
      supabase: base.supabase,
      admin,
      error: (error?.message || "Accès partenaire refusé") as string,
      isPartner: false as const,
      partner: null,
    }
  }

  return {
    user: base.user,
    supabase: base.supabase,
    admin,
    partner: role,
    error: null,
    isPartner: true as const,
  }
}
