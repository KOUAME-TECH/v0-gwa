"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Building2, Loader2, CheckCircle2, MapPin } from "lucide-react"
import { toast } from "sonner"

interface Coop {
  id: string
  name: string
  city: string | null
  country: string | null
  logo_url: string | null
  is_verified: boolean
}

function RejoindreContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const coopId = searchParams.get("coop")
  const supabase = createClient()

  const [coop, setCoop] = useState<Coop | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=/cooperatives/rejoindre?coop=${coopId || ""}`)
        return
      }
      if (!coopId) { setLoading(false); return }
      const { data } = await supabase
        .from("cooperatives")
        .select("id, name, city, country, logo_url, is_verified")
        .eq("id", coopId)
        .maybeSingle()
      setCoop(data)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopId])

  async function handleJoin() {
    if (!coopId) return
    setJoining(true)
    try {
      const res = await fetch("/api/cooperatives/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coop_id: coopId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Erreur")
      toast.success("Vous avez rejoint la coopérative")
      router.push("/dashboard")
    } catch (err: any) {
      toast.error(err.message || "Impossible de rejoindre")
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FDF4] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#059669]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0FDF4]">
      <header className="flex items-center h-14 px-4 bg-white border-b">
        <button onClick={() => router.back()} className="p-2 -ml-2"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-semibold ml-2">Rejoindre une coopérative</h1>
      </header>

      <div className="p-4">
        {!coop ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 text-[#059669]/30 mx-auto mb-4" />
              <h2 className="font-semibold text-[#111827] mb-2">Invitation invalide</h2>
              <p className="text-sm text-[#4B5563]">Ce lien d'invitation n'est pas valide ou la coopérative n'existe plus.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-[#059669]/10 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                {coop.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coop.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="h-9 w-9 text-[#059669]" />
                )}
              </div>
              <h2 className="text-xl font-bold text-[#111827] flex items-center justify-center gap-1.5">
                {coop.name}
                {coop.is_verified && <CheckCircle2 className="h-5 w-5 text-[#059669]" />}
              </h2>
              {(coop.city || coop.country) && (
                <p className="text-sm text-[#4B5563] flex items-center justify-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[coop.city, coop.country].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="text-sm text-[#4B5563] mt-4 mb-6">
                Vous êtes invité à rejoindre cette coopérative en tant que membre.
              </p>
              <Button onClick={handleJoin} disabled={joining} className="w-full h-12 rounded-full bg-[#059669] hover:bg-[#047857] text-base font-semibold">
                {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : "Rejoindre la coopérative"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function RejoindreCooperativePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F0FDF4] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#059669]" />
      </div>
    }>
      <RejoindreContent />
    </Suspense>
  )
}
