import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyCartChanged } from "@/lib/cart/events"

/** Ajoute ou incrémente une ligne panier, puis notifie les badges. */
export async function addOrIncrementCart(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  qty = 1,
): Promise<{ ok: boolean; error?: string }> {
  const amount = Math.max(1, Math.floor(qty))
  const { data: existing, error: findErr } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle()

  if (findErr) return { ok: false, error: findErr.message }

  if (existing?.id) {
    const next = (Number(existing.quantity) || 0) + amount
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: next })
      .eq("id", existing.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from("cart_items").insert({
      user_id: userId,
      product_id: productId,
      quantity: amount,
    })
    if (error) return { ok: false, error: error.message }
  }

  notifyCartChanged()
  return { ok: true }
}
