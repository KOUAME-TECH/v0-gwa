"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const ORDERS_CHANGED = "gwa:orders-changed"

export function notifyOrdersChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(ORDERS_CHANGED))
}

/**
 * Badge Shop = nombre de commandes actives (achats ou ventes en cours),
 * hors livrées / annulées.
 */
export function useActiveOrdersCount() {
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

      const active = ["pending", "confirmed", "processing", "shipped", "disputed"]

      const [asBuyer, asSeller] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", user.id)
          .in("status", active),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", user.id)
          .in("status", active),
      ])

      setCount((asBuyer.count || 0) + (asSeller.count || 0))
    } catch {
      /* ignore */
    }
  }, [supabase])

  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(ORDERS_CHANGED, onChange)
    window.addEventListener("focus", onChange)
    return () => {
      window.removeEventListener(ORDERS_CHANGED, onChange)
      window.removeEventListener("focus", onChange)
    }
  }, [refresh])

  return { count, refresh }
}

export { ORDERS_CHANGED }
