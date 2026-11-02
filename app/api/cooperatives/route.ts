import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  COOP_DOCS_DEADLINE_MONTHS,
  COOP_MEMBERS_DEADLINE_DAYS,
} from "@/lib/cooperatives/validation-policy"
import { coopCreateSchema } from "@/lib/cooperatives/create-schema"

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

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const rawBody = await request.json().catch(() => null)
    const parsed = coopCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Données invalides",
          code: "VALIDATION",
        },
        { status: 400 },
      )
    }
    const body = parsed.data
    const name = body.name
    const city = body.city

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
        description: body.description || null,
        sector: body.sector || body.cooperative_type || "agriculture",
        country: body.country || "Cote d'Ivoire",
        city,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        registration_number: body.registration_number || null,
        founded_year: body.founded_year ?? null,
        logo_url: body.logo_url || null,
        admin_id: user.id,
        is_verified: false,
        validation_status: "pending_validation",
        members_deadline_at: membersDeadline.toISOString(),
        docs_deadline_at: docsDeadline.toISOString(),
      })
      .select("id, name, slug, validation_status")
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
