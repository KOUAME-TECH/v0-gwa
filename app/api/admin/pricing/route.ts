import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"

const PLAN_FIELDS = [
  "monthly_fee",
  "commission_rate",
  "buyer_service_fee_fixed",
  "buyer_service_fee_rate",
  "franchise_threshold",
  "franchise_cap",
  "switch_threshold",
  "is_active",
] as const

function isFieldError(value: unknown): value is { error: string } {
  return Boolean(value) && typeof value === "object" && "error" in (value as object)
}

function intField(value: unknown, allowNull: boolean) {
  if (value === null || value === "") return allowNull ? null : { error: "nombre requis" }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return { error: "entier positif requis" }
  return n
}

function rateField(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1) return { error: "taux entre 0 et 1" }
  return n
}

export async function GET() {
  try {
    const gate = await requireAdminSection("pricing")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }
    const [plans, settings, audit] = await Promise.all([
      gate.admin.from("pricing_plans").select("*").order("target").order("monthly_fee"),
      gate.admin.from("pricing_settings").select("*").eq("id", 1).maybeSingle(),
      gate.admin
        .from("pricing_plan_audit")
        .select("id, plan_id, actor_id, action, before_state, after_state, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ])
    if (plans.error) {
      return NextResponse.json(
        { error: "Migration 067 requise", code: "MIGRATION_REQUIRED" },
        { status: 503 },
      )
    }
    return NextResponse.json({
      plans: plans.data ?? [],
      settings: settings.data,
      audit: audit.data ?? [],
    })
  } catch (err) {
    console.error("[api/admin/pricing GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }
    const gate = await requireAdminSection("pricing")
    if (!gate.isAdmin || !gate.admin || !gate.user) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const body = await request.json().catch(() => null)
    if (body?.settings) {
      const aggregatorRate = rateField(body.settings.aggregator_rate)
      const aggregatorFixed = intField(body.settings.aggregator_fixed, false)
      const alert = intField(body.settings.margin_alert_fcfa, false)
      if (isFieldError(aggregatorRate) || isFieldError(aggregatorFixed) || isFieldError(alert)) {
        return NextResponse.json({ error: "Paramètres simulateur invalides" }, { status: 400 })
      }
      const { data: before } = await gate.admin
        .from("pricing_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle()
      const next = {
        aggregator_rate: aggregatorRate,
        aggregator_fixed: aggregatorFixed,
        margin_alert_fcfa: alert,
        updated_at: new Date().toISOString(),
      }
      const { error } = await gate.admin.from("pricing_settings").update(next).eq("id", 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      await gate.admin.from("pricing_plan_audit").insert({
        actor_id: gate.user.id,
        action: "settings_update",
        before_state: before,
        after_state: next,
      })
      return NextResponse.json({ success: true })
    }

    const planId = String(body?.plan_id || "")
    if (!planId) return NextResponse.json({ error: "plan_id requis" }, { status: 400 })

    const { data: before, error: findError } = await gate.admin
      .from("pricing_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle()
    if (findError || !before) {
      return NextResponse.json({ error: "Offre introuvable" }, { status: 404 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of PLAN_FIELDS) {
      if (!(key in (body?.patch || {}))) continue
      const raw = body.patch[key]
      if (key === "is_active") {
        patch[key] = Boolean(raw)
        continue
      }
      if (key === "commission_rate" || key === "buyer_service_fee_rate") {
        const parsed = rateField(raw)
        if (isFieldError(parsed)) {
          return NextResponse.json({ error: `${key}: ${parsed.error}` }, { status: 400 })
        }
        patch[key] = parsed
        continue
      }
      const parsed = intField(raw, key === "switch_threshold")
      if (isFieldError(parsed)) {
        return NextResponse.json({ error: `${key}: ${parsed.error}` }, { status: 400 })
      }
      patch[key] = parsed
    }

    const { data: after, error } = await gate.admin
      .from("pricing_plans")
      .update(patch)
      .eq("id", planId)
      .select("*")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await gate.admin.from("pricing_plan_audit").insert({
      plan_id: planId,
      actor_id: gate.user.id,
      action: "plan_update",
      before_state: before,
      after_state: after,
    })
    return NextResponse.json({ success: true, plan: after })
  } catch (err) {
    console.error("[api/admin/pricing PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
