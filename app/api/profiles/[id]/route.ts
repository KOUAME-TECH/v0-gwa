import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeProfileCompletion } from "@/lib/auth/post-auth"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizeHtml, sanitizePlainText } from "@/lib/security/validation"

const PUBLIC_FIELDS =
  "id, full_name, avatar_url, bio, user_type, sub_type, country, city, is_verified, rating, total_reviews, scg_score, scg_badge, scg_bancable, created_at"

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

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isOwner = user?.id === id
    let profile: Record<string, unknown> | null = null
    if (isOwner) {
      const { data, error } = await supabase.rpc("profile_self")
      const row = Array.isArray(data) ? data[0] : data
      if (!error && row) {
        profile = { ...(row as Record<string, unknown>), email: user.email || null }
      }
    }
    if (!profile) {
      const { data, error } = await supabase
        .from("profiles")
        .select(PUBLIC_FIELDS)
        .eq("id", id)
        .maybeSingle()
      if (error || !data) {
        return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
      }
      profile = isOwner ? { ...(data as Record<string, unknown>), email: user?.email || null } : data
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

    const updates: Record<string, unknown> = {}

    for (const field of PATCHABLE_FIELDS) {
      if (!(field in body)) continue
      const value = body[field]
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

    const { data: self } = await supabase.rpc("profile_self")
    const existing = (Array.isArray(self) ? self[0] : self) as {
      full_name?: string | null
      user_type?: string | null
      country?: string | null
      city?: string | null
      phone?: string | null
      email?: string | null
    } | null

    updates.profile_completion_pct = computeProfileCompletion({
      ...existing,
      ...updates,
    })
    updates.updated_at = new Date().toISOString()

    const { error } = await supabase.from("profiles").update(updates).eq("id", id)

    if (error) {
      console.error("[profiles/[id] PATCH]", error.message)
      return NextResponse.json({ error: "Mise à jour impossible" }, { status: 400 })
    }

    const { data: refreshed } = await supabase.rpc("profile_self")
    const profile = Array.isArray(refreshed) ? refreshed[0] : refreshed

    return NextResponse.json({
      profile,
      completion_pct: (profile as unknown as { profile_completion_pct?: number } | null)?.profile_completion_pct ?? 0,
    })
  } catch (err) {
    console.error("[profiles/[id] PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
