"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isTransientNetworkError, type SessionKind } from "@/lib/auth/session-state"

const RETRY_DELAY_MS = 350
const INITIAL_SESSION_WAIT_MS = 1500

async function readSession(supabase: SupabaseClient): Promise<SessionKind> {
  const { data, error } = await supabase.auth.getSession()
  if (error && isTransientNetworkError(error)) return "unavailable"
  return data.session?.user ? "authenticated" : "anonymous"
}

/**
 * Attend getSession, puis INITIAL_SESSION / SIGNED_IN, avant de conclure
 * qu'il n'y a pas de compte. Un timeout réseau est retenté une fois.
 */
export async function waitForBrowserSession(
  supabase: SupabaseClient,
): Promise<SessionKind> {
  let kind = await readSession(supabase)
  if (kind === "unavailable") {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    kind = await readSession(supabase)
  }
  if (kind !== "anonymous") return kind

  return new Promise((resolve) => {
    let settled = false
    const finish = (next: SessionKind) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      subscription.unsubscribe()
      resolve(next)
    }

    const timer = setTimeout(() => finish("anonymous"), INITIAL_SESSION_WAIT_MS)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== "INITIAL_SESSION" &&
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return
      }
      finish(session?.user ? "authenticated" : "anonymous")
    })
  })
}
