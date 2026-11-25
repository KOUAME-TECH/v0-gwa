"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { WALLET_FLAG } from "@/lib/feature-flags/core"

/**
 * Faux tant que le drapeau public n'est pas activé en base.
 * Fail-closed : erreur, ligne ou table absente → false.
 */
export function useFeatureFlag(name: string): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    let cancelled = false
    try {
      const supabase = createClient()
      void supabase
        .from("feature_flags")
        .select("is_active_public")
        .eq("name", name)
        .maybeSingle()
        .then(
          ({ data, error }) => {
            if (!cancelled) setIsActive(!error && data?.is_active_public === true)
          },
          () => {
            if (!cancelled) setIsActive(false)
          },
        )
    } catch {
      setIsActive(false)
    }
    return () => {
      cancelled = true
    }
  }, [name])

  return isActive
}

/** Wallet / versements : masqué jusqu'à l'agrément BCEAO (directive CEO 25/11). */
export function useWalletEnabled(): boolean {
  return useFeatureFlag(WALLET_FLAG)
}
