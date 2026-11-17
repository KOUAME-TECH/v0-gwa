import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeProfileCompletion } from "@/lib/auth/post-auth"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { profileUpdateSchema } from "@/lib/validation/profile"
import { sanitizeHtml, sanitizePlainText } from "@/lib/security/validation"

const PUBLIC_FIELDS =
  "id, full_name, avatar_url, bio, user_type, sub_type, country, city, is_verified, rating, total_reviews, scg_score, scg_badge, scg_bancable, created_at"

const OWNER_EXTRA_FIELDS =
  ", email, phone, address, auth_method, preferred_language, digest_enabled, profile_completion_pct, onboarding_completed_at, scg_calculated_at, updated_at"

const PATCHABLE_FIELDS = [
  "full_name",
  "bio",
  "country",
  "city",
  "address",
  "avatar_url",
  // user_type / sub_type : interdits en self-service (voir 049 + admin)
  "preferred_language",
  "digest_enabled",
  "production_type",
  "surface_area",
  "craft_type",
  "experience_years",
  "member_count",
  "registration_number",
] as const

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

async function readOwnProfile(supabase: SupabaseServer, fields: string) {
  const { data, error } = await supabase.rpc("get_own_profile").maybeSingle()
  if (error || !data) return { data: null, error }
  const row = data as Record<string, unknown>
  const picked: Record<string, unknown> = {}
  for (const key of fields.split(",").map((f) => f.trim())) {
    picked[key] = row[key] ?? null
  }
  return { data: picked, error: null }
}

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isOwner = user?.id === id
    const selectFields = isOwner ? PUBLIC_FIELDS + OWNER_EXTRA_FIELDS : PUBLIC_FIELDS

    // Propriétaire : RPC SECURITY DEFINER (colonnes PII révoquées par 037).
    // Tiers : uniquement les champs publics via RLS/column grants.
    const { data: profile, error } = isOwner
      ? await readOwnProfile(supabase, selectFields)
      : await supabase.from("profiles").select(selectFields).eq("id", id).maybeSingle()

    if (error || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
    }

    return NextResponse.json({
      profile,
      is_owner: isOwner,
    })
  } catch (err) {
    console.error("[profiles/[id] GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    if (user.id !== id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const body = await request.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
    }

    const picked: Record<string, unknown> = {}
    for (const field of PATCHABLE_FIELDS) {
      if (field in body && body[field] !== null && body[field] !== undefined) {
        picked[field] = body[field]
      }
    }
    const parsed = profileUpdateSchema.safeParse(picked)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const validated = parsed.data as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    for (const field of PATCHABLE_FIELDS) {
      if (!(field in validated)) continue
      const value = validated[field]
      if (value === null || value === undefined) continue

      if (field === "bio" && typeof value === "string") {
        updates.bio = sanitizeHtml(value).slice(0, 2000)
        continue
      }

      if (typeof value === "string") {
        updates[field] = sanitizePlainText(value, 500)
      } else if (typeof value === "number" || typeof value === "boolean") {
        updates[field] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 })
    }

    const { data: existingRow } = await supabase.rpc("get_own_profile").maybeSingle()
    const existing = (existingRow ?? {}) as Record<string, unknown>

    updates.profile_completion_pct = computeProfileCompletion({
      ...existing,
      ...updates,
    })
    updates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[profiles/[id] PATCH]", error.message)
      return NextResponse.json({ error: "Mise à jour impossible" }, { status: 400 })
    }

    const { data: profile } = await readOwnProfile(supabase, PUBLIC_FIELDS + OWNER_EXTRA_FIELDS)

    return NextResponse.json({
      profile,
      completion_pct: (profile as unknown as { profile_completion_pct?: number } | null)?.profile_completion_pct ?? 0,
    })
  } catch (err) {
    console.error("[profiles/[id] PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
