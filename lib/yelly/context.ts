import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sanitizePlainText } from "@/lib/security/validation"
import { parseOfferContent } from "@/lib/chat/offer"
import type { ChatTurn } from "@/lib/yelly/capabilities"
import type { YellyProductContext } from "@/lib/yelly/context-builder"

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
    return 0
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

/** Produit structuré pour le contexte Yelly (aucune donnée vendeur). */
export async function loadYellyProductContext(
  supabase: SupabaseClient,
  productId?: string,
): Promise<YellyProductContext | null> {
  if (!productId) return null
  const { data } = await supabase
    .from("products")
    .select("name, price, unit, ville, origin_region, prix_ocpv_ref_fcfa, status")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle()
  if (!data) return null
  return {
    name: String(data.name || ""),
    price: typeof data.price === "number" ? data.price : Number(data.price) || null,
    unit: data.unit || null,
    city: data.ville || null,
    region: data.origin_region || null,
    ocpvReference: data.prix_ocpv_ref_fcfa ?? null,
  }
}

/**
 * Derniers messages d’une conversation GWA dont l’utilisateur est participant.
 * RLS + contrôle explicite : aucun accès à une conversation tierce.
 * Les messages « Conseil IA » sont exclus (pas d’auto-alimentation).
 */
export async function loadChatTurnsForYelly(
  supabase: SupabaseClient,
  chatConversationId: string | undefined,
  userId: string,
  limit = 10,
): Promise<ChatTurn[]> {
  if (!chatConversationId) return []
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, participant_1, participant_2")
    .eq("id", chatConversationId)
    .maybeSingle()
  if (!conv || (conv.participant_1 !== userId && conv.participant_2 !== userId)) return []
  const { data } = await supabase
    .from("messages")
    .select("sender_id, content, message_type, created_at")
    .eq("conversation_id", chatConversationId)
    .neq("message_type", "ai")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data || [])
    .reverse()
    .map((m: { sender_id: string; content: string | null; message_type: string | null }) => {
      const author: ChatTurn["author"] = m.sender_id === userId ? "moi" : "autre"
      if (m.message_type === "offer") {
        const offer = parseOfferContent(m.content || "")
        if (offer) {
          return {
            author,
            text: `Offre ${offer.amount} FCFA${offer.productName ? ` pour ${offer.productName}` : ""} (${offer.status})`,
            offerAmount: offer.amount,
            offerStatus: offer.status,
          }
        }
      }
      return { author, text: sanitizePlainText(String(m.content || ""), 300) }
    })
    .filter((t) => t.text)
}
