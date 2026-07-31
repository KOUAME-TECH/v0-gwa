"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { dashboardPathForUserType } from "@/lib/dashboard/routing"
import { Loader2, Sprout, ShoppingCart, Users, Building2 } from "lucide-react"

/**
 * Hub `/dashboard` → espace rôle (acheteur / producteur / coop).
 * Ne redirige PAS vers `/admin` : le backoffice a son entrée « Administration ».
 */
export default function DashboardPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string>("Chargement...")

  useEffect(() => {
    const redirectToDashboard = async () => {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      const userType = profile?.user_type || "acheteur"
      const target = dashboardPathForUserType(userType)

      const statusByPath: Record<string, string> = {
        "/dashboard/farmer": "Redirection vers votre espace Producteur...",
        "/dashboard/cooperative": "Redirection vers votre espace Coopérative...",
        "/dashboard/buyer": "Redirection vers votre espace Acheteur...",
      }
      setStatus(statusByPath[target] || "Redirection...")
      router.replace(target)
    }

    void redirectToDashboard()
  }, [router])

  const getIcon = () => {
    if (status.includes("Producteur") || status.includes("Vendeur"))
      return <Sprout className="h-12 w-12 text-[#2F7D32]" />
    if (status.includes("Acheteur"))
      return <ShoppingCart className="h-12 w-12 text-[#1976D2]" />
    if (status.includes("Coopérative") || status.includes("Cooperative"))
      return <Users className="h-12 w-12 text-[#7B1FA2]" />
    if (status.includes("Entreprise") || status.includes("Transformateur"))
      return <Building2 className="h-12 w-12 text-[#455A64]" />
    return <Loader2 className="h-12 w-12 text-[#2F7D32] animate-spin" />
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="mb-6 flex justify-center">{getIcon()}</div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">Bienvenue sur GWA</h1>
        <p className="text-[#4B5563]">{status}</p>
        <div className="mt-6 flex justify-center gap-1">
          <div
            className="w-2 h-2 rounded-full bg-[#2F7D32] animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-[#2F7D32] animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-[#2F7D32] animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  )
}
