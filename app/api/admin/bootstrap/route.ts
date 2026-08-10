import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

function bootstrapSecretRequired(): boolean {
  return (
    !!process.env.BOOTSTRAP_ADMIN_SECRET ||
    process.env.VERCEL_ENV === "production"
  )
}

function assertBootstrapSecret(request: NextRequest): NextResponse | null {
  if (!bootstrapSecretRequired()) return null
  const expected = process.env.BOOTSTRAP_ADMIN_SECRET || ""
  if (!expected) {
    return NextResponse.json(
      {
        error: "BOOTSTRAP_ADMIN_SECRET requis en production",
        code: "BOOTSTRAP_SECRET_MISSING",
      },
      { status: 503 },
    )
  }
  const provided = request.headers.get("x-gwa-bootstrap-secret") || ""
  if (provided !== expected) {
    return NextResponse.json(
      { error: "Secret bootstrap invalide", code: "BOOTSTRAP_FORBIDDEN" },
      { status: 403 },
    )
  }
  return null
}

/**
 * POST /api/admin/bootstrap
 * Si aucun admin actif : promeut l'utilisateur connecté en super_admin (seed 1er admin).
 * Si des admins existent déjà : 403 (sauf déjà admin).
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const secretErr = assertBootstrapSecret(request)
    if (secretErr) return secretErr

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: myRole } = await admin
      .from("admin_roles")
      .select("user_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (myRole) {
      return NextResponse.json({
        ok: true,
        alreadyAdmin: true,
        role: myRole.role || "active",
      })
    }

    // Advisory lock-style: refuse if any active admin already exists
    const { count: beforeCount } = await admin
      .from("admin_roles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    if ((beforeCount || 0) > 0) {
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
        granted_at: new Date().toISOString(),
      })
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 })
      }
    }

    // Race: another bootstrap may have won — deactivate ours if older admin exists
    const { count: afterCount } = await admin
      .from("admin_roles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    if ((afterCount || 0) > 1) {
      const { data: older } = await admin
        .from("admin_roles")
        .select("user_id, granted_at")
        .eq("is_active", true)
        .neq("user_id", user.id)
        .order("granted_at", { ascending: true })
        .limit(1)

      if (older && older.length > 0) {
        await admin
          .from("admin_roles")
          .update({ is_active: false })
          .eq("user_id", user.id)
        return NextResponse.json(
          {
            error: "Des admins existent déjà. Demande une promotion à un super_admin.",
            code: "ADMINS_EXIST",
            raced: true,
          },
          { status: 403 },
        )
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
