import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth/require-admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizePlainText } from "@/lib/security/validation"
import {
  COOP_DOCS_DEADLINE_MONTHS,
  COOP_MEMBERS_DEADLINE_DAYS,
} from "@/lib/cooperatives/validation-policy"

/**
 * POST /api/cooperatives
 * Crée une coopérative en statut « en validation » et bascule le profil
 * en user_type=cooperative via service_role (self-service user_type interdit).
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
    }

    const name = sanitizePlainText(String(body.name || ""), 120)
    const city = sanitizePlainText(String(body.city || ""), 80)
    if (!name || !city) {
      return NextResponse.json(
        { error: "Nom et ville sont obligatoires" },
        { status: 400 },
      )
    }

    const now = new Date()
    const membersDeadline = new Date(
      now.getTime() + COOP_MEMBERS_DEADLINE_DAYS * 86_400_000,
    )
    const docsDeadline = new Date(now)
    docsDeadline.setMonth(docsDeadline.getMonth() + COOP_DOCS_DEADLINE_MONTHS)

    const baseSlug =
      name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "coop"
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    const admin = createAdminClient()
    const { data: coop, error } = await admin
      .from("cooperatives")
      .insert({
        name,
        slug,
        description: sanitizePlainText(String(body.description || ""), 2000) || null,
        sector: sanitizePlainText(String(body.sector || body.cooperative_type || "agriculture"), 60),
        country: sanitizePlainText(String(body.country || "Cote d'Ivoire"), 80),
        city,
        address: sanitizePlainText(String(body.address || ""), 200) || null,
        phone: sanitizePlainText(String(body.phone || ""), 30) || null,
        email: sanitizePlainText(String(body.email || ""), 120) || null,
        registration_number:
          sanitizePlainText(String(body.registration_number || ""), 80) || null,
        founded_year: Number.parseInt(String(body.founded_year || ""), 10) || null,
        logo_url: typeof body.logo_url === "string" ? body.logo_url.slice(0, 500) : null,
        admin_id: user.id,
        is_verified: false,
        validation_status: "pending_validation",
        members_deadline_at: membersDeadline.toISOString(),
        docs_deadline_at: docsDeadline.toISOString(),
        invite_code: randomBytes(16).toString("hex"),
      })
      .select("id, name, slug, validation_status, invite_code")
      .single()

    if (error || !coop) {
      console.error("[api/cooperatives POST]", error?.message)
      return NextResponse.json(
        { error: error?.message || "Création impossible" },
        { status: 400 },
      )
    }

    await admin.from("cooperative_members").upsert(
      {
        cooperative_id: coop.id,
        user_id: user.id,
        role: "admin",
        is_active: true,
      },
      { onConflict: "cooperative_id,user_id" },
    )

    await admin
      .from("profiles")
      .update({
        coop_id: coop.id,
        user_type: "cooperative",
        updated_at: now.toISOString(),
      })
      .eq("id", user.id)

    return NextResponse.json({
      success: true,
      cooperative: coop,
      policy: {
        status: "pending_validation",
        label: "Coopérative en validation",
        members_required: 15,
        members_deadline_days: COOP_MEMBERS_DEADLINE_DAYS,
        docs_deadline_months: COOP_DOCS_DEADLINE_MONTHS,
      },
    })
  } catch (err) {
    console.error("[api/cooperatives POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
