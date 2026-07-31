"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isDualIdentity } from "@/lib/auth/dual-identity"

/**
 * Bandeau discret hors /admin : rappelle l’accès backoffice
 * (surtout utile en double identité admin + compte métier).
 */
export function AdminModeBanner() {
  const pathname = usePathname() || "/"
  const [show, setShow] = useState(false)
  const [dual, setDual] = useState(false)

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) {
      setShow(false)
      return
    }

    let mounted = true
    const run = async () => {
      try {
        const res = await fetch("/api/auth/admin-status")
        const data = await res.json().catch(() => ({}))
        if (!mounted || !data.isAdmin) {
          if (mounted) setShow(false)
          return
        }

        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        let userType: string | null = null
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle()
          userType = profile?.user_type ?? null
        }

        if (!mounted) return
        setDual(isDualIdentity(true, userType))
        setShow(true)
      } catch {
        if (mounted) setShow(false)
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [pathname])

  if (!show) return null

  return (
    <div
      role="status"
      className="border-b border-[#1F5C2E]/15 bg-[#1F5C2E] text-white"
    >
      <div className="gwa-shell-page flex items-center justify-between gap-3 py-2 text-sm">
        <p className="flex items-center gap-2 min-w-0">
          <Shield className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="truncate">
            {dual
              ? "Compte métier actif · accès backoffice disponible"
              : "Session administrateur"}
          </span>
        </p>
        <Link
          href="/admin"
          className="shrink-0 rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Backoffice
        </Link>
      </div>
    </div>
  )
}
