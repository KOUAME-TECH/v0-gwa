import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/** Aligné RLS settings_update_admin : admin | super_admin */
const SETTINGS_WRITE_ROLES = new Set(["admin", "super_admin"])

const EDITABLE_KEYS = [
  "commission_rate",
  "min_withdrawal",
  "max_images_per_product",
  "auto_approve_verified_sellers",
  "maintenance_mode",
] as const

type EditableKey = (typeof EDITABLE_KEYS)[number]

function mapSettings(rows: { key: string; value: unknown }[]) {
  const settingsMap: Record<string, unknown> = {}
  for (const item of rows) {
    settingsMap[item.key] = item.value
  }

  return {
    commission_rate: (settingsMap.commission_rate as {
      agriculture: number
      default: number
    }) || { agriculture: 5, default: 6 },
    min_withdrawal: (settingsMap.min_withdrawal as {
      XOF: number
      EUR: number
      USD: number
    }) || { XOF: 5000, EUR: 10, USD: 10 },
    max_images_per_product: Number(settingsMap.max_images_per_product) || 10,
    auto_approve_verified_sellers:
      settingsMap.auto_approve_verified_sellers === true ||
      settingsMap.auto_approve_verified_sellers === "true",
    maintenance_mode:
      settingsMap.maintenance_mode === true ||
      settingsMap.maintenance_mode === "true",
    supported_countries: (settingsMap.supported_countries as string[]) || [],
    supported_currencies: (settingsMap.supported_currencies as string[]) || [],
    payment_methods: (settingsMap.payment_methods as string[]) || [],
  }
}

/** GET /api/admin/settings — lecture platform_settings (service role) */
export async function GET() {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("settings")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { data, error } = await gate.admin
      .from("platform_settings")
      .select("key, value")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ settings: mapSettings(data || []) })
  } catch (err) {
    console.error("[api/admin/settings GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/settings
 * Body: partial PlatformSettings (clés éditables uniquement).
 * Auth: admin | super_admin (requireAdmin + filtre rôle).
 */
export async function PATCH(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("settings")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    if (!SETTINGS_WRITE_ROLES.has(gate.role.role)) {
      return NextResponse.json(
        { error: "Administrateur requis pour modifier les paramètres" },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body JSON requis" }, { status: 400 })
    }

    const updates: { key: EditableKey; value: unknown }[] = []
    for (const key of EDITABLE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updates.push({ key, value: body[key] })
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucune clé éditable fournie (commission_rate|min_withdrawal|max_images_per_product|auto_approve_verified_sellers|maintenance_mode)",
        },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const oldSnapshot: Record<string, unknown> = {}
    const newSnapshot: Record<string, unknown> = {}

    for (const update of updates) {
      const { data: existing } = await gate.admin
        .from("platform_settings")
        .select("key, value")
        .eq("key", update.key)
        .maybeSingle()

      oldSnapshot[update.key] = existing?.value ?? null
      newSnapshot[update.key] = update.value

      const { error } = await gate.admin
        .from("platform_settings")
        .update({
          value: update.value,
          updated_by: gate.user.id,
          updated_at: now,
        })
        .eq("key", update.key)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    await gate.admin.from("admin_logs").insert({
      admin_id: gate.user.id,
      action: "update_settings",
      entity_type: "platform_settings",
      old_data: oldSnapshot,
      new_data: newSnapshot,
    })

    const { data: refreshed } = await gate.admin
      .from("platform_settings")
      .select("key, value")

    return NextResponse.json({
      success: true,
      settings: mapSettings(refreshed || []),
    })
  } catch (err) {
    console.error("[api/admin/settings PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
