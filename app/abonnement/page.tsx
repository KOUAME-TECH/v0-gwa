"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, Crown, Loader2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatFcfa, SELLER_PLANS, type SellerPlan } from "@/lib/pricing/plans"
import {
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"
import { WHATSAPP_LINK } from "@/lib/contact"
import { isSellerRole } from "@/lib/dashboard/routing"
import { cn } from "@/lib/utils"

export default function AbonnementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [tier, setTier] = useState<SubscriptionTier>("free")
  const [userType, setUserType] = useState<string | null>(null)
  const [pendingTier, setPendingTier] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login?redirect=/abonnement")
      return
    }

    const res = await fetch("/api/subscriptions/request")
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setTier(normalizeSubscriptionTier(data.tier))
      setUserType(data.user_type || null)
      if (data.latestRequest?.status === "pending") {
        setPendingTier(data.latestRequest.requested_tier)
      } else {
        setPendingTier(null)
      }
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, user_type")
        .eq("id", user.id)
        .maybeSingle()
      setTier(normalizeSubscriptionTier(profile?.subscription_tier))
      setUserType(profile?.user_type || null)
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requestPlan = async (plan: SellerPlan) => {
    if (plan.tier === "free" || plan.tier === tier) return
    setBusy(plan.tier)
    try {
      const res = await fetch("/api/subscriptions/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: plan.tier }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Demande impossible")
        return
      }

      setPendingTier(plan.tier)
      const amount =
        plan.priceFcfa != null ? `${formatFcfa(plan.priceFcfa)} FCFA/mois` : "devis"
      const msg = encodeURIComponent(
        `Bonjour GWA, je souhaite l’abonnement ${plan.label} (${amount}).` +
          `\nMon compte: ${data.profile?.phone || data.profile?.full_name || ""}` +
          `\nRéf demande: ${data.request?.id || ""}`,
      )
      toast.success("Demande enregistrée — finalise sur WhatsApp")
      window.open(`${WHATSAPP_LINK}?text=${msg}`, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#FFF6E5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  const seller = isSellerRole(userType)

  return (
    <div className="min-h-dvh bg-[#FFF6E5] pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center h-14 px-4 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-2 -ml-2" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold ml-2">Abonnement vendeur</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {!seller && (
          <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 text-sm text-[#4B5563]">
            Les abonnements sont pour les vendeurs (producteurs / coopératives).{" "}
            <Link href="/contact" className="text-[#2F7D32] underline">
              Contact
            </Link>
          </div>
        )}

        <div className="rounded-2xl bg-[#2F7D32] text-white p-4">
          <p className="text-sm text-white/80">Ton palier actuel</p>
          <p className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Crown className="h-6 w-6" />
            {SELLER_PLANS.find((p) => p.tier === tier)?.label || "Gratuit"}
          </p>
          <p className="text-sm text-white/90 mt-1">
            Commission{" "}
            {SELLER_PLANS.find((p) => p.tier === tier)?.commissionLabel || "8 %"}{" "}
            sur tes ventes
          </p>
          {pendingTier && (
            <p className="text-xs mt-2 bg-white/15 rounded-lg px-2 py-1.5">
              Demande {pendingTier} en cours — finalise le paiement WhatsApp.
            </p>
          )}
        </div>

        <p className="text-sm text-[#4B5563]">
          Acheteurs : gratuit. Toi vendeur : moins de commission = plus tu montes de palier.
        </p>

        <div className="space-y-3">
          {SELLER_PLANS.map((plan) => {
            const isCurrent = plan.tier === tier
            const isPending = pendingTier === plan.tier
            return (
              <div
                key={plan.tier}
                className={cn(
                  "rounded-2xl border bg-white p-4",
                  isCurrent ? "border-[#2F7D32] ring-1 ring-[#2F7D32]/30" : "border-[#E5E7EB]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-[#111827]">{plan.label}</h2>
                      {isCurrent && (
                        <Badge className="bg-[#2F7D32]/10 text-[#2F7D32]">Actuel</Badge>
                      )}
                      {isPending && !isCurrent && (
                        <Badge className="bg-amber-100 text-amber-800">En attente</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">{plan.headline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#111827]">
                      {plan.priceFcfa == null
                        ? "Sur devis"
                        : plan.priceFcfa === 0
                          ? "0"
                          : `${formatFcfa(plan.priceFcfa)}`}
                    </p>
                    {plan.priceFcfa != null && plan.priceFcfa > 0 && (
                      <p className="text-[11px] text-[#9CA3AF]">FCFA / mois</p>
                    )}
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {plan.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-[#4B5563]">
                      <Check className="h-4 w-4 text-[#2F7D32] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {seller && plan.tier !== "free" && (
                  <Button
                    className="w-full mt-4 bg-[#2F7D32] hover:bg-[#256025]"
                    disabled={isCurrent || busy === plan.tier}
                    onClick={() => void requestPlan(plan)}
                  >
                    {busy === plan.tier ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        {isCurrent ? "Plan actuel" : isPending ? "Rouvrir WhatsApp" : plan.cta}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[11px] text-[#9CA3AF] text-center pb-4">
          Chaque palier débloque des services réels (annonces, commission, boost, stats,
          priorité nouveautés / avance sur vente). Paiement Mobile Money via WhatsApp — activation sous 24 h.
        </p>
      </main>
    </div>
  )
}
