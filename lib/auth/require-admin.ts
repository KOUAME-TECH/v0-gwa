import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  type AdminAction,
  type AdminRole,
  type AdminSection,
  canAccessSection,
  canPerformAdminAction,
  isAdminRole,
  isSuperAdmin,
} from "@/lib/auth/admin-permissions"

/** Session utilisateur requise — API routes. Refuse comptes suspendus. */
export async function requireUser(opts?: { allowSuspended?: boolean }) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, supabase, error: "Non authentifié" as const }
  }
  if (!opts?.allowSuspended) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.is_suspended) {
      return {
        user: null,
        supabase,
        error: "Compte suspendu" as const,
        suspended: true as const,
      }
    }
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

  // Rôle DB inconnu → refuser (ne jamais promouvoir en "admin")
  if (!isAdminRole(role.role)) {
    console.warn("[requireAdmin] rôle inconnu refusé:", role.role)
    return {
      user: base.user,
      supabase: base.supabase,
      error: "Rôle admin invalide" as const,
      isAdmin: false as const,
    }
  }

  return {
    user: base.user,
    supabase: base.supabase,
    admin,
    role: { ...role, role: role.role as AdminRole },
    error: null,
    isAdmin: true as const,
  }
}

/** Admin + accès section (matrice ROLE_SECTIONS) */
export async function requireAdminSection(section: AdminSection) {
  const gate = await requireAdmin()
  if (!gate.isAdmin) return gate

  if (!canAccessSection(gate.role.role, section)) {
    return {
      ...gate,
      isAdmin: false as const,
      error: "Accès section refusé" as const,
    }
  }

  return gate
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
