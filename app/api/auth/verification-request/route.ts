import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/auth/verification-request
 * Soft KYC : pièce + selfie. Ne bloque jamais login/signup.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const documents = body?.documents
    if (!Array.isArray(documents) || documents.length < 2) {
      return NextResponse.json(
        { error: "Pièce d'identité et selfie requis" },
        { status: 400 },
      )
    }

    const hasId = documents.some(
      (d: { type?: string; url?: string }) =>
        d?.type === "id_document" && typeof d.url === "string",
    )
    const hasSelfie = documents.some(
      (d: { type?: string; url?: string }) =>
        d?.type === "selfie" && typeof d.url === "string",
    )
    if (!hasId || !hasSelfie) {
      return NextResponse.json(
        { error: "Documents incomplets (id_document + selfie)" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: pending } = await admin
      .from("verification_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("request_type", "user")
      .eq("status", "pending")
      .maybeSingle()

    if (pending) {
      return NextResponse.json(
        { error: "Une demande est déjà en cours", code: "ALREADY_PENDING" },
        { status: 409 },
      )
    }

    const { data, error } = await admin
      .from("verification_requests")
      .insert({
        user_id: user.id,
        request_type: "user",
        documents,
        status: "pending",
        notes: "KYC utilisateur — pièce + selfie",
      })
      .select("id, status")
      .single()

    if (error) {
      console.error("[verification-request]", error.message)
      return NextResponse.json(
        { error: "Impossible d'enregistrer la demande" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, request: data })
  } catch (err) {
    console.error("[verification-request]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
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
    const { data } = await admin
      .from("verification_requests")
      .select("id, status, created_at, reviewed_at, notes")
      .eq("user_id", user.id)
      .eq("request_type", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ request: data || null })
  } catch (err) {
    console.error("[verification-request GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
