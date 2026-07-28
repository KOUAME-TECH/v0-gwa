import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  canChangeMemberRole,
  isCoopMemberRole,
  type CoopMemberRole,
} from "@/lib/cooperatives/roles"

/**
 * PATCH /api/cooperatives/members
 * Habilite / retire un gestionnaire (admin|manager|member).
 * Body: { cooperative_id, user_id, role }
 * Réservé aux administrateurs de la coopérative.
 */
export async function PATCH(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const cooperativeId = String(body?.cooperative_id || "")
    const targetUserId = String(body?.user_id || "")
    const newRoleRaw = body?.role

    if (!cooperativeId || !targetUserId || !isCoopMemberRole(newRoleRaw)) {
      return NextResponse.json(
        { error: "cooperative_id, user_id et role (admin|manager|member) requis" },
        { status: 400 },
      )
    }
    const newRole = newRoleRaw as CoopMemberRole

    const admin = createAdminClient()

    const { data: actorRow } = await admin
      .from("cooperative_members")
      .select("role, is_active")
      .eq("cooperative_id", cooperativeId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!actorRow || actorRow.is_active === false || !isCoopMemberRole(actorRow.role)) {
      return NextResponse.json(
        { error: "Vous n’êtes pas membre actif de cette coopérative" },
        { status: 403 },
      )
    }

    const { data: targetRow } = await admin
      .from("cooperative_members")
      .select("id, role, is_active")
      .eq("cooperative_id", cooperativeId)
      .eq("user_id", targetUserId)
      .maybeSingle()

    if (!targetRow || !isCoopMemberRole(targetRow.role)) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 })
    }

    const { count: adminCount } = await admin
      .from("cooperative_members")
      .select("id", { count: "exact", head: true })
      .eq("cooperative_id", cooperativeId)
      .eq("role", "admin")
      .neq("is_active", false)

    const gate = canChangeMemberRole({
      actorRole: actorRow.role,
      targetCurrentRole: targetRow.role,
      targetNewRole: newRole,
      targetIsSelf: targetUserId === user.id,
      adminCount: adminCount ?? 0,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 })
    }

    const { error: updErr } = await admin
      .from("cooperative_members")
      .update({ role: newRole, is_active: true })
      .eq("id", targetRow.id)

    if (updErr) {
      console.error("[api/cooperatives/members] update", updErr.message)
      return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 })
    }

    // Si on promeut un 2e admin, on ne change pas admin_id (titulaire historique).
    // Si on retire le titulaire admin_id de son rôle admin et qu’il reste un autre admin,
    // on peut réaffecter admin_id au premier admin restant.
    if (targetRow.role === "admin" && newRole !== "admin") {
      const { data: coop } = await admin
        .from("cooperatives")
        .select("admin_id")
        .eq("id", cooperativeId)
        .maybeSingle()

      if (coop?.admin_id === targetUserId) {
        const { data: nextAdmin } = await admin
          .from("cooperative_members")
          .select("user_id")
          .eq("cooperative_id", cooperativeId)
          .eq("role", "admin")
          .neq("is_active", false)
          .neq("user_id", targetUserId)
          .limit(1)
          .maybeSingle()

        if (nextAdmin?.user_id) {
          await admin
            .from("cooperatives")
            .update({ admin_id: nextAdmin.user_id, updated_at: new Date().toISOString() })
            .eq("id", cooperativeId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      member: { user_id: targetUserId, role: newRole },
    })
  } catch (err) {
    console.error("[api/cooperatives/members]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
