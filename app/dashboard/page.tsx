"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Sprout, Palette, ShoppingCart, Users, Building2 } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string>("Chargement...")

  useEffect(() => {
    const redirectToDashboard = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/auth/login")
        return
      }

      // Vérifier si admin
      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single()

      if (adminRole) {
        setStatus("Redirection vers l'administration...")
        router.push("/admin")
        return
      }

      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single()

      const userType = profile?.user_type || "buyer"

      // Rediriger selon le type (valeurs DB: farmer, artisan, buyer, cooperative, business, processor)
      switch (userType) {
        case "farmer":
        case "processor":
          setStatus("Redirection vers votre espace Producteur...")
          router.push("/dashboard/farmer")
          break
        case "artisan":
          setStatus("Redirection vers votre espace Artisan...")
          router.push("/dashboard/artisan")
          break
        case "buyer":
          setStatus("Redirection vers votre espace Acheteur...")
          router.push("/dashboard/buyer")
          break
        case "cooperative":
          setStatus("Redirection vers votre espace Cooperative...")
          router.push("/dashboard/cooperative")
          break
        case "business":
          setStatus("Redirection vers votre espace Entreprise...")
          router.push("/dashboard/business")
          break
        default:
          setStatus("Redirection vers votre espace...")
          router.push("/dashboard/buyer")
      }
    }

    redirectToDashboard()
  }, [router])

  const getIcon = () => {
    if (status.includes("Producteur")) return <Sprout className="h-12 w-12 text-[#2F7D32]" />
    if (status.includes("Artisan")) return <Palette className="h-12 w-12 text-[#8B4513]" />
    if (status.includes("Acheteur")) return <ShoppingCart className="h-12 w-12 text-[#1976D2]" />
    if (status.includes("Coopérative") || status.includes("Cooperative")) return <Users className="h-12 w-12 text-[#7B1FA2]" />
    if (status.includes("Entreprise")) return <Building2 className="h-12 w-12 text-[#455A64]" />
    return <Loader2 className="h-12 w-12 text-[#2F7D32] animate-spin" />
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="mb-6 flex justify-center">
          {getIcon()}
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">
          Bienvenue sur GWA
        </h1>
        <p className="text-[#4B5563]">{status}</p>
        <div className="mt-6 flex justify-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#2F7D32] animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-[#2F7D32] animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-[#2F7D32] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  )
}
