import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { canToggleFeatureFlag } from "@/lib/auth/admin-permissions"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  featureFlagPatchSchema,
  isMissingColumnError,
  type FeatureFlagRow,
} from "@/lib/feature-flags/admin"
import { clearFeatureFlagCache } from "@/lib/feature-flags/core"

/**
 * Back-office feature flags (GSAC-3).
 * GET   /api/admin/features — liste (admins section "features")
 * PATCH /api/admin/features — bascule d'un drapeau (super_admin / admin ;
 *        wallet et internal_wallet : super_admin uniquement). Zod, rate limit,
 *        audit_logs + admin_logs. Si l'audit échoue, la bascule est annulée.
 * 2FA TOTP admin : second temps (hors périmètre).
 */

const NO_STORE = { "Cache-Control": "no-store" }

function deny(gate: { user: unknown; error?: string | null }) {
  return NextResponse.json(
    { error: gate.error || "Accès refusé" },
    { status: gate.user ? 403 : 401, headers: NO_STORE },
  )
}

export async function GET() {
  try {
    const gate = await requireAdminSection("features")
    if (!gate.isAdmin || !gate.admin) return deny(gate)

    const rate = await checkRateLimit("API_GENERAL", gate.user.id)
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: NO_STORE })
    }

    const { data, error } = await gate.admin
      .from("feature_flags")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("[api/admin/features GET]", error.message)
      return NextResponse.json({ error: "Lecture impossible" }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ flags: (data || []) as FeatureFlagRow[] }, { headers: NO_STORE })
  } catch (err) {
    console.error("[api/admin/features GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: NO_STORE })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireAdminSection("features")
    if (!gate.isAdmin || !gate.admin) return deny(gate)

    const rate = await checkRateLimit("ADMIN_FLAG_WRITE", gate.user.id)
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429, headers: NO_STORE })
    }

    const raw = await request.json().catch(() => null)
    const parsed = featureFlagPatchSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requête invalide", issues: parsed.error.issues.map((i) => i.message) },
        { status: 400, headers: NO_STORE },
      )
    }
    const input = parsed.data

    if (!canToggleFeatureFlag(gate.role.role, input.name)) {
      return NextResponse.json(
        { error: "Rôle insuffisant pour ce drapeau" },
        { status: 403, headers: NO_STORE },
      )
    }

    const { data: before, error: readError } = await gate.admin
      .from("feature_flags")
      .select("*")
      .eq("name", input.name)
      .maybeSingle()

    if (readError) {
      console.error("[api/admin/features PATCH read]", readError.message)
      return NextResponse.json({ error: "Lecture impossible" }, { status: 500, headers: NO_STORE })
    }
    if (!before) {
      return NextResponse.json(
        { error: "Drapeau absent en base (migration requise)", code: "FLAG_NOT_FOUND" },
        { status: 404, headers: NO_STORE },
      )
    }

    const changes: Partial<FeatureFlagRow> = {}
    if (input.is_active_public !== undefined) changes.is_active_public = input.is_active_public
    if (input.is_active_beta !== undefined) changes.is_active_beta = input.is_active_beta

    const now = new Date().toISOString()
    let update = await gate.admin
      .from("feature_flags")
      .update({ ...changes, updated_at: now, updated_by: gate.user.id })
      .eq("name", input.name)
      .select("*")
      .maybeSingle()

    // 082 non appliquée : colonnes updated_at / updated_by absentes.
    if (update.error && isMissingColumnError(update.error)) {
      update = await gate.admin
        .from("feature_flags")
        .update(changes)
        .eq("name", input.name)
        .select("*")
        .maybeSingle()
    }

    if (update.error || !update.data) {
      console.error("[api/admin/features PATCH update]", update.error?.message)
      return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500, headers: NO_STORE })
    }

    const beforeSnapshot = {
      is_active_public: (before as FeatureFlagRow).is_active_public,
      is_active_beta: (before as FeatureFlagRow).is_active_beta,
    }
    const afterSnapshot = {
      is_active_public: (update.data as FeatureFlagRow).is_active_public,
      is_active_beta: (update.data as FeatureFlagRow).is_active_beta,
    }

    const { error: auditError } = await gate.admin.from("audit_logs").insert({
      action: "feature_flag_update",
      user_id: gate.user.id,
      target_type: "feature_flag",
      metadata: {
        flag: input.name,
        before: beforeSnapshot,
        after: afterSnapshot,
        role: gate.role.role,
        reason: input.reason ?? null,
      },
      ip_address:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 45) || null,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
      severity: input.name === "wallet" || input.name === "internal_wallet" ? "critical" : "warning",
    })

    if (auditError) {
      // Pas de bascule sans trace : on annule.
      console.error("[api/admin/features PATCH audit]", auditError.message)
      await gate.admin.from("feature_flags").update(beforeSnapshot).eq("name", input.name)
      return NextResponse.json(
        { error: "Audit impossible, bascule annulée" },
        { status: 500, headers: NO_STORE },
      )
    }

    const { error: adminLogError } = await gate.admin.from("admin_logs").insert({
      admin_id: gate.user.id,
      action: "update_feature_flag",
      entity_type: "feature_flags",
      old_data: { name: input.name, ...beforeSnapshot },
      new_data: { name: input.name, ...afterSnapshot },
      notes: input.reason ?? null,
    })
    if (adminLogError) console.warn("[api/admin/features PATCH admin_logs]", adminLogError.message)

    clearFeatureFlagCache()
    return NextResponse.json({ success: true, flag: update.data }, { headers: NO_STORE })
  } catch (err) {
    console.error("[api/admin/features PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: NO_STORE })
  }
}
