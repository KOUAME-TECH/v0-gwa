import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * POST /api/admin/bootstrap
 * Si aucun admin actif : promeut l'utilisateur connecté en super_admin (seed 1er admin).
 * Si des admins existent déjà : 403 (sauf déjà admin).
 */
export async function POST() {
  try {
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

    const admin = createAdminClient()

    const { data: existing } = await admin
      .from("admin_roles")
      .select("user_id, role, is_active")
      .eq("is_active", true)
      .limit(5)

    const alreadyAdmin = (existing || []).some((r) => r.user_id === user.id)
    if (alreadyAdmin) {
      return NextResponse.json({ ok: true, alreadyAdmin: true, role: "active" })
    }

    if ((existing || []).length > 0) {
      return NextResponse.json(
        {
          error: "Des admins existent déjà. Demande une promotion à un super_admin.",
          code: "ADMINS_EXIST",
        },
        { status: 403 },
      )
    }

    const { error } = await admin.from("admin_roles").upsert(
      {
        user_id: user.id,
        role: "super_admin",
        is_active: true,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (error) {
      // fallback insert without upsert constraint name
      const { error: insertErr } = await admin.from("admin_roles").insert({
        user_id: user.id,
        role: "super_admin",
        is_active: true,
      })
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 })
      }
    }

    // Audit best-effort (table peut différer selon migrations)
    try {
      await admin.from("admin_audit_log").insert({
        admin_id: user.id,
        action: "bootstrap_first_admin",
        target_type: "admin_roles",
        target_id: user.id,
        details: { role: "super_admin" },
      })
    } catch {
      // non bloquant
    }

    return NextResponse.json({
      ok: true,
      seeded: true,
      user_id: user.id,
      role: "super_admin",
      message: "Tu es le premier admin. Va sur /admin.",
    })
  } catch (err) {
    console.error("[admin/bootstrap]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur bootstrap" },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { count } = await admin
      .from("admin_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("is_active", true)

    const { data: me } = await admin
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    return NextResponse.json({
      adminCount: count ?? 0,
      needsBootstrap: (count ?? 0) === 0,
      alreadyAdmin: !!me,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    )
  }
}
