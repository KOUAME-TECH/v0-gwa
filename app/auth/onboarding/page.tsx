"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Sprout, Users, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const SUB_TYPES = [
  {
    value: "producteur_individuel" as const,
    userType: "producteur",
    label: "Producteur individuel",
    description: "Exploitation agricole personnelle, vente directe de vos récoltes.",
    icon: Sprout,
    redirect: "/auth/signup?resume=onboarding&type=farmer",
  },
  {
    value: "cooperative" as const,
    userType: "cooperative",
    label: "Coopérative",
    description: "Groupement de producteurs, gestion collective et commandes B2B.",
    icon: Users,
    redirect: "/auth/signup?resume=onboarding&type=cooperative",
  },
]

function OnboardingForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login?redirect=/auth/onboarding")
        return
      }

      supabase
        .from("profiles")
        .select("sub_type, user_type")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (profile?.sub_type) {
            const match = SUB_TYPES.find((s) => s.value === profile.sub_type)
            router.replace(match?.redirect ?? "/profil")
            return
          }
          setLoading(false)
        })
    })
  }, [router, supabase])

  const handleSelect = async (option: (typeof SUB_TYPES)[number]) => {
    setSubmitting(option.value)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace("/auth/login?redirect=/auth/onboarding")
      return
    }

    const res = await fetch(`/api/profiles/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sub_type: option.value,
        user_type: option.userType,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Enregistrement impossible")
      setSubmitting(null)
      return
    }

    await supabase
      .from("profiles")
      .update({
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    router.push(option.redirect)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-6 safe-top">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#1A1A1A]">Votre profil GWA</h1>
            <p className="text-sm text-[#6B7280]">Choisissez votre type de compte</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-[#FFF8E1] border border-[#FFE082] p-3">
          <AlertCircle className="h-4 w-4 text-[#F9A825] mt-0.5 shrink-0" />
          <p className="text-xs text-[#6B7280]">
            Ce choix ne peut pas être modifié sans contacter GWA.
          </p>
        </div>

        <div className="space-y-4">
          {SUB_TYPES.map((option) => {
            const Icon = option.icon
            const isSubmitting = submitting === option.value

            return (
              <Card
                key={option.value}
                className={cn(
                  "p-5 border-2 transition-colors",
                  isSubmitting ? "border-[#2F7D32]" : "border-transparent hover:border-[#2F7D32]/30",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#2F7D32]/10 flex items-center justify-center shrink-0">
                    <Icon className="h-6 w-6 text-[#2F7D32]" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="font-semibold text-[#1A1A1A]">{option.label}</h2>
                      <p className="text-sm text-[#6B7280] mt-1">{option.description}</p>
                    </div>
                    <Button
                      onClick={() => handleSelect(option)}
                      disabled={!!submitting}
                      className="w-full bg-[#2F7D32] hover:bg-[#1B5E20]"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Choisir"
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {error && <p className="text-sm text-[#E53935] text-center">{error}</p>}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
          <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
        </div>
      }
    >
      <OnboardingForm />
    </Suspense>
  )
}
