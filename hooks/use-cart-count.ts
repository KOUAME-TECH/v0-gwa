"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CART_CHANGED_EVENT } from "@/lib/cart/events"

/** Nombre d’articles au panier (somme des quantités) + écoute live. */
export function useCartCount() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCount(0)
        return
      }
      const { data } = await supabase
        .from("cart_items")
        .select("quantity")
        .eq("user_id", user.id)
      const sum = (data || []).reduce(
        (s: number, row: { quantity?: number | null }) => s + (Number(row.quantity) || 0),
        0,
      )
      setCount(sum)
    } catch {
      /* ignore */
    }
  }, [supabase])

  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(CART_CHANGED_EVENT, onChange)
    window.addEventListener("focus", onChange)
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, onChange)
      window.removeEventListener("focus", onChange)
    }
  }, [refresh])

  return { count, refresh }
}
