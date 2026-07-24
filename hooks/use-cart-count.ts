"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CART_CHANGED_EVENT } from "@/lib/cart/events"
import { guestCartProductCount } from "@/lib/cart/guest"

/**
 * Badge charette = nombre de produits distincts (lignes panier),
 * pas la somme des quantités.
 */
export function useCartCount() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCount(guestCartProductCount())
        return
      }
      const { count: n, error } = await supabase
        .from("cart_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
      if (error) {
        setCount(0)
        return
      }
      setCount(n || 0)
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
