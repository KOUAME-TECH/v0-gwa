import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { joinBuyerRequest } from "@/lib/features/agritech/rfq-engine"

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request)
  if (csrf) return csrf

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour rejoindre cette offre." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const buyerRequestId = String(body?.buyerRequestId || "")
  const volumeCommitted = Math.floor(Number(body?.volumeCommitted) || 0)
  const priceOffered = body?.priceOffered == null ? null : Math.round(Number(body.priceOffered))
  if (!buyerRequestId || volumeCommitted <= 0) {
    return NextResponse.json({ error: "Indique un volume pour rejoindre l’offre." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()
  if (!["producteur", "farmer", "cooperative"].includes(String(profile?.user_type || ""))) {
    return NextResponse.json(
      { error: "Seuls les producteurs et les coopératives peuvent rejoindre une offre." },
      { status: 403 },
    )
  }

  const { data: flag } = await admin
    .from("feature_flags")
    .select("is_active_public, is_active_beta")
    .eq("name", "rfq_aggregation")
    .maybeSingle()

  const { data: existing } = await admin
    .from("aggregated_offers")
    .select("volume_committed")
    .eq("buyer_request_id", buyerRequestId)
    .neq("status", "cancelled")
  const already = (existing || []).reduce((sum, row) => sum + (Number(row.volume_committed) || 0), 0)

  const result = await joinBuyerRequest(admin as never, {
    buyerRequestId,
    producerId: user.id,
    volumeCommitted,
    priceOffered,
    flagsOpen: Boolean(flag?.is_active_public || flag?.is_active_beta),
    committedAfterJoin: already + volumeCommitted,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  if (result.matched) {
    const { data: requestRow } = await admin
      .from("buyer_requests")
      .select("buyer_id")
      .eq("id", buyerRequestId)
      .maybeSingle()
    if (requestRow?.buyer_id) {
      await admin.from("notifications").insert({
        user_id: requestRow.buyer_id,
        type: "order",
        title: "Offre groupée complète",
        message: "Les producteurs ont couvert le volume demandé.",
        body: "Les producteurs ont couvert le volume demandé.",
        link: "/dashboard/buyer",
        is_read: false,
        read: false,
      })
    }
  }

  return NextResponse.json({ ok: true, matched: result.matched })
}
