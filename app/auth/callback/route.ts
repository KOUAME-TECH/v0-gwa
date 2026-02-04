"use server"

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"
  const error = searchParams.get("error")
  const error_description = searchParams.get("error_description")

  // Handle error from Supabase
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || "Une erreur s'est produite")}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=exchange_error&message=${encodeURIComponent(exchangeError.message)}`
      )
    }

    // Get user to check profile type
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Check user profile to redirect to appropriate dashboard
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      let redirectPath = "/dashboard"
      
      if (profile?.user_type) {
        const dashboardRoutes: Record<string, string> = {
          producteur: "/dashboard/farmer",
          artisan: "/dashboard/artisan",
          transformateur: "/dashboard/business",
          acheteur: "/dashboard/buyer",
          cooperative: "/dashboard/cooperative",
          entreprise: "/dashboard/business",
        }
        redirectPath = dashboardRoutes[profile.user_type] || "/dashboard"
      }

      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  // No code or user, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}
