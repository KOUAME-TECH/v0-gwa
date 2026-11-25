import { resolvePostAuthRedirect } from "@/lib/auth/post-auth"
import { safeOAuthNextPath } from "@/lib/auth/oauth"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeOAuthNextPath(searchParams.get("next"))
  const error = searchParams.get("error")
  const error_description = searchParams.get("error_description")

  // Handle error from Supabase
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || "Une erreur s'est produite")}`
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = []
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              pendingCookies.push({ name, value, options })
            })
          },
        },
      },
    )
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    const redirectWithSession = (url: string) => {
      const response = NextResponse.redirect(url)
      for (const cookie of pendingCookies) {
        response.cookies.set(cookie.name, cookie.value, cookie.options)
      }
      return response
    }

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=exchange_error&message=${encodeURIComponent(exchangeError.message)}`
      )
    }

    // Get user to check profile type
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Brancher SCG si aucun score encore — écriture serveur (service role) uniquement (084).
      try {
        const { ensureInitialScg } = await import("@/lib/scg/persist")
        await ensureInitialScg(user.id)
      } catch (scgErr) {
        console.error("[auth/callback] SCG:", scgErr)
      }

      if (next) {
        return redirectWithSession(`${origin}${next}`)
      }

      const { path: redirectPath } = await resolvePostAuthRedirect(supabase, user.id)
      return redirectWithSession(`${origin}${redirectPath}`)
    }
  }

  // No code or user, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}
