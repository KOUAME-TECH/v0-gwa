import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

// Attach the singleton to globalThis so it survives module re-evaluation
// across separate bundles. A plain module-level variable can be duplicated
// when the module is bundled into multiple chunks, which creates several
// GoTrueClient instances fighting over the same auth storage key and can
// corrupt the auth lock (leading to "Failed to fetch" during sign in).
const globalForSupabase = globalThis as unknown as {
  __gwaSupabaseClient?: SupabaseClient
}

function buildClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase config manquante: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY non defini.',
    )
  }

  return createBrowserClient(url, anonKey)
}

export function createClient(): SupabaseClient {
  // Server-side: always create a fresh client (no shared mutable state).
  if (typeof window === 'undefined') {
    return buildClient()
  }

  // Client-side: reuse a single instance across the whole browser context.
  if (!globalForSupabase.__gwaSupabaseClient) {
    globalForSupabase.__gwaSupabaseClient = buildClient()
  }

  return globalForSupabase.__gwaSupabaseClient
}
