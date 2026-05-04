import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

// Global singleton to prevent multiple GoTrueClient instances
let supabaseInstance: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  // Server-side: always create new instance (but this shouldn't be called server-side)
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  // Client-side: return cached singleton
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return supabaseInstance
}
