import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sanitizePlainText } from "@/lib/security/validation"

/** Début du jour civil (UTC = Africa/Abidjan, sans DST). */
export function yellyDayStartIso(now = new Date()): string {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Compte les messages user Yelly depuis le début du jour (quota abo / admin IA). */
export async function countYellyUserMessagesToday(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
  opts?: { pageEq?: string; pageNeq?: string },
): Promise<number> {
  const since = yellyDayStartIso(now)
  let convQuery = supabase
    .from("yelly_conversations")
    .select("id")
    .eq("user_id", userId)
  if (opts?.pageEq) convQuery = convQuery.eq("page", opts.pageEq)
  if (opts?.pageNeq) convQuery = convQuery.neq("page", opts.pageNeq)

  const { data: convs, error: convErr } = await convQuery
  if (convErr || !convs?.length) return 0

  const ids = convs.map((c) => c.id)
  const { count, error } = await supabase
    .from("yelly_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since)
    .in("conversation_id", ids)

  if (error) {
    console.warn("[yelly] count today", error.message)
    // Fail-closed : refuse le quota « 0 utilisé » en cas d’erreur lecture
    return Number.MAX_SAFE_INTEGER
  }
  return count ?? 0
}

/** Contexte léger produit pour Yelly (pas de PII vendeur). */
export async function loadYellyProductHint(
  supabase: SupabaseClient,
  productId?: string,
): Promise<string | undefined> {
  if (!productId) return undefined
  const { data } = await supabase
    .from("products")
    .select("id, name, price, unit, ville, origin_region, product_type, status")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle()

  if (!data) return undefined
  const parts = [
    `Produit: ${sanitizePlainText(String(data.name || ""), 80)}`,
    `Prix: ${data.price} ${data.unit || "FCFA"}`,
    data.ville ? `Ville: ${sanitizePlainText(String(data.ville), 60)}` : null,
    data.origin_region
      ? `Région: ${sanitizePlainText(String(data.origin_region), 60)}`
      : null,
    data.product_type ? `Type: ${data.product_type}` : null,
  ].filter(Boolean)
  return parts.join(" · ")
}

export type YellyProfileContext = {
  userType: string | null
  tier: string | null
  city: string | null
  scgScore: number | null
  scgBancable: boolean | null
  orderHint?: string
  coopHint?: string
}

/** Profil + hints commandes/coop pour réponses précises (sans PII sensible). */
export async function loadYellyProfileContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<YellyProfileContext> {
  const empty: YellyProfileContext = {
    userType: null,
    tier: null,
    city: null,
    scgScore: null,
    scgBancable: null,
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type, subscription_tier, city, scg_score, scg_bancable")
      .eq("id", userId)
      .maybeSingle()

    if (!profile) return empty

    const city = (profile as { city?: string | null }).city || null

    let orderHint: string | undefined
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, status, escrow_status, payment_status, created_at")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(3)

    if (recentOrders?.length) {
      orderHint = `Commandes récentes: ${recentOrders
        .map((o) => {
          const short = String(o.id).slice(0, 8)
          return `#${short} statut=${o.status || "?"} escrow=${o.escrow_status || "?"} pay=${o.payment_status || "?"}`
        })
        .join(" ; ")}`
    }

    let coopHint: string | undefined
    const userType = (profile as { user_type?: string | null }).user_type
    if (userType === "cooperative") {
      const { data: coop } = await supabase
        .from("cooperatives")
        .select("id, name, validation_status")
        .eq("admin_id", userId)
        .maybeSingle()
      if (coop) {
        const { count } = await supabase
          .from("cooperative_members")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coop.id)
          .eq("is_active", true)
        coopHint = `Coop: ${sanitizePlainText(String(coop.name || ""), 60)} statut=${coop.validation_status || "?"} membres≈${count ?? "?"}`
      }
    }

    return {
      userType: userType ?? null,
      tier: (profile as { subscription_tier?: string | null }).subscription_tier ?? null,
      city: city ? sanitizePlainText(String(city), 60) : null,
      scgScore:
        typeof (profile as { scg_score?: number | null }).scg_score === "number"
          ? (profile as { scg_score: number }).scg_score
          : null,
      scgBancable:
        typeof (profile as { scg_bancable?: boolean | null }).scg_bancable ===
        "boolean"
          ? (profile as { scg_bancable: boolean }).scg_bancable
          : null,
      orderHint,
      coopHint,
    }
  } catch (err) {
    console.warn("[yelly] profile context", err)
    return empty
  }
}

/** Historique multi-tour pour le LLM (derniers messages de la conversation). */
export async function loadYellyConversationHistory(
  supabase: SupabaseClient,
  opts: {
    userId: string
    conversationId?: string | null
    limit?: number
  },
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const limit = Math.min(Math.max(opts.limit ?? 6, 2), 12)
  try {
    let conversationId = opts.conversationId || null

    if (!conversationId) {
      const { data: latest } = await supabase
        .from("yelly_conversations")
        .select("id")
        .eq("user_id", opts.userId)
        .neq("page", "admin-assist")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      conversationId = latest?.id || null
    } else {
      const { data: owned } = await supabase
        .from("yelly_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", opts.userId)
        .maybeSingle()
      if (!owned) return []
    }

    if (!conversationId) return []

    const { data: rows } = await supabase
      .from("yelly_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .limit(limit)

    if (!rows?.length) return []

    return [...rows]
      .reverse()
      .map((r) => ({
        role: (r.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: String(r.content || "").slice(0, 800),
      }))
      .filter((m) => m.content.length > 0)
  } catch (err) {
    console.warn("[yelly] history", err)
    return []
  }
}

export async function persistYellyTurn(
  supabase: SupabaseClient,
  opts: {
    userId: string
    conversationId?: string | null
    userMessage: string
    assistantReply: string
    page?: string
    source: string
  },
): Promise<string | null> {
  try {
    let conversationId = opts.conversationId || null

    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from("yelly_conversations")
        .insert({
          user_id: opts.userId,
          page: opts.page?.slice(0, 120) || null,
        })
        .select("id")
        .single()
      if (error || !conv) {
        console.warn("[yelly] conv insert", error?.message)
        return null
      }
      conversationId = conv.id
    }

    const rows = [
      {
        conversation_id: conversationId,
        role: "user",
        content: opts.userMessage.slice(0, 800),
        source: null,
      },
      {
        conversation_id: conversationId,
        role: "assistant",
        content: opts.assistantReply.slice(0, 1200),
        source: opts.source,
      },
    ]

    const { error: msgErr } = await supabase.from("yelly_messages").insert(rows)
    if (msgErr) console.warn("[yelly] messages insert", msgErr.message)

    await supabase
      .from("yelly_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)

    return conversationId
  } catch (err) {
    console.warn("[yelly] persist", err)
    return null
  }
}
