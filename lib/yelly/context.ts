import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sanitizePlainText } from "@/lib/security/validation"

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
