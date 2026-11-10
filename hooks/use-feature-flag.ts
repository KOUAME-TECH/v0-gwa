"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/** Faux tant que le drapeau public n'est pas activé en base. */
export function useFeatureFlag(name: string): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("feature_flags")
      .select("is_active_public")
      .eq("name", name)
      .maybeSingle()
      .then(({ data }) => setIsActive(Boolean(data?.is_active_public)))
  }, [name])

  return isActive
}
