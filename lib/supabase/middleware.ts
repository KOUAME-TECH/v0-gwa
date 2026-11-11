import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isTransientNetworkError,
  shouldRedirectToLogin,
  TRANSIENT_AUTH_RETRY_LIMIT,
} from '@/lib/auth/session-state'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const path = request.nextUrl.pathname
  const method = request.method.toUpperCase()

  // Routes publiques GET sans cookie session → pas de getUser (TTFB)
  const publicFast =
    method === "GET" &&
    (path === "/" ||
      path === "/marketplace" ||
      path === "/agriculture" ||
      path === "/recherche" ||
      path === "/conditions" ||
      path === "/confidentialite" ||
      path === "/contact" ||
      path === "/download" ||
      path === "/auth/callback" ||
      path === "/auth/login" ||
      path === "/auth/signup" ||
      path === "/auth/error" ||
      path.startsWith("/produit/") ||
      path.startsWith("/post/") ||
      (path.startsWith("/profil/") && !path.startsWith("/profil/edit")))

  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("-auth-token") ||
        c.name.startsWith("sb-") && c.name.includes("auth"),
    )

  if (publicFast && !hasAuthCookie) {
    return supabaseResponse
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  let user: { id: string } | null = null
  let authError: { message?: string; name?: string; status?: number } | null = null

  const readUser = async () => {
    try {
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    } catch (err) {
      user = null
      authError =
        err instanceof Error
          ? { message: err.message, name: err.name }
          : { message: "fetch failed" }
    }
  }

  await readUser()
  for (
    let attempt = 0;
    !user &&
    isTransientNetworkError(authError) &&
    attempt < TRANSIENT_AUTH_RETRY_LIMIT;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    await readUser()
  }

  const protectedPrefixes = [
    '/protected',
    '/admin',
    '/dashboard',
    '/profil/edit',
    '/publier',
    '/messages',
    '/notifications',
    '/wallet',
    '/commandes',
    '/abonnement',
    '/scg',
    '/affacturage',
  ]
  const needsAuth = protectedPrefixes.some(
    (p) => path === p || path.startsWith(`${p}/`),
  )

  // Un timeout vers Auth n'est pas une session absente : la page affiche Réessayer.
  // Une 500 durable ou un échec non réseau redirige vers la connexion.
  if (
    shouldRedirectToLogin({
      needsAuth,
      hasUser: Boolean(user),
      error: authError,
    })
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Inventaire interne — jamais en production
  if (
    path.startsWith('/dev') &&
    (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // /admin : session requise ; rôle admin vérifié dans app/admin/layout (server)
  // Les mutations admin doivent passer par API + service role (pas le client anon).

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
