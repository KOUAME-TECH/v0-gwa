import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { isSellerRole } from "@/lib/dashboard/routing"
import { applyPlanSwitch, evaluatePlanSwitch } from "@/lib/pricing/switch"

async function sellerId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle()
  if (!isSellerRole(profile?.user_type)) {
    return { error: NextResponse.json({ error: "Réservé aux vendeurs" }, { status: 403 }) }
  }
  return { id: user.id }
}

export async function GET() {
  try {
    const who = await sellerId()
    if ("error" in who && who.error) return who.error
    const status = await evaluatePlanSwitch(who.id as string)
    return NextResponse.json(status)
  } catch (err) {
    console.error("[api/pricing/switch GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }
    const who = await sellerId()
    if ("error" in who && who.error) return who.error
    const result = await applyPlanSwitch(who.id as string, who.id as string)
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, plan: result.plan })
  } catch (err) {
    console.error("[api/pricing/switch POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
