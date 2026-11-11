import "server-only"

import { cookies } from "next/headers"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  classifySession,
  hasSupabaseAuthCookie,
  isTransientNetworkError,
  type SessionKind,
} from "@/lib/auth/session-state"

const RETRY_DELAY_MS = 350

export type ServerSession = {
  kind: SessionKind
  user: User | null
  supabase: SupabaseClient
  hasAuthCookie: boolean
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Session lue sur le serveur, après le rafraîchissement des cookies dans proxy.ts.
 * getUser() est la source de vérité. Un timeout est retenté une fois avant
 * d'être classé « unavailable » (cookie présent) plutôt que « déconnecté ».
 */
export async function readServerSession(): Promise<ServerSession> {
  const cookieStore = await cookies()
  const hasAuthCookie = hasSupabaseAuthCookie(cookieStore.getAll())
  const supabase = await createClient()

  let user: User | null = null
  let transientError = false

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.auth.getUser()
    user = data.user ?? null
    transientError = isTransientNetworkError(error)
    if (user || !transientError || attempt === 1) break
    await pause(RETRY_DELAY_MS)
  }

  return {
    kind: classifySession({
      hasAuthCookie,
      hasUser: Boolean(user),
      transientError,
    }),
    user,
    supabase,
    hasAuthCookie,
  }
}
