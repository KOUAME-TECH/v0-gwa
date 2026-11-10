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
  legacyTierPlanName,
  type PricingPlanInput,
  seedPlan,
  subscriptionTierForPlan,
} from "@/lib/pricing/quote"
import { loadPricingPlans } from "@/lib/pricing/load-plans"
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
  const [plans, setPlans] = useState<PricingPlanInput[] | null>(null)

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
    void loadPricingPlans().then(setPlans)
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

  if (loading || !plans) {
    return (
      <div className="min-h-dvh bg-[#FFF6E5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  const seller = isSellerRole(userType)
  const catalog = plans
  const currentCode = legacyTierPlanName(userType, tier)
  const currentPlan =
    catalog.find((plan) => plan.name === currentCode || plan.displayName === currentCode) ||
    seedPlan(currentCode)
  const visiblePlans = catalog.filter(
    (plan) => plan.target === (userType === "cooperative" ? "cooperative" : "producer"),
  )

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
            {currentPlan.displayName || currentPlan.name}
          </p>
          <p className="text-sm text-white/90 mt-1">
            Commission {Math.round(currentPlan.commission_rate * 100)} % sur tes ventes
          </p>
          {pendingTier && (
            <p className="text-xs mt-2 bg-white/15 rounded-lg px-2 py-1.5">
              Demande {pendingTier} en cours — finalise le paiement WhatsApp.
            </p>
          )}
        </div>

        <p className="text-sm text-[#4B5563]">
          L’acheteur paie un frais de service ajouté à chaque commande, lu dans les réglages (250 FCFA). Toi, vendeur : la commission baisse quand tu montes de palier.
        </p>

        <div className="space-y-3">
          {visiblePlans.map((seed) => {
            const tierKey = subscriptionTierForPlan(seed.name)
            const plan = SELLER_PLANS.find((item) => item.tier === tierKey) as SellerPlan
            const isCurrent = seed.name === currentPlan.name
            const isPending = pendingTier === tierKey
            const priceLabel =
              seed.name === "COOP_ENTERPRISE"
                ? "Sur devis"
                : seed.monthly_fee === 0
                  ? "0"
                  : formatFcfa(seed.monthly_fee)
            return (
              <div
                key={seed.name}
                className={cn(
                  "rounded-2xl border bg-white p-4",
                  isCurrent ? "border-[#2F7D32] ring-1 ring-[#2F7D32]/30" : "border-[#E5E7EB]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-[#111827]">{seed.displayName || seed.name}</h2>
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
                    <p className="font-bold text-[#111827]">{priceLabel}</p>
                    {seed.monthly_fee > 0 && seed.name !== "COOP_ENTERPRISE" && (
                      <p className="text-[11px] text-[#9CA3AF]">FCFA / mois</p>
                    )}
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {[
                    `Commission ${Math.round(seed.commission_rate * 100)} %`,
                    ...plan.benefits.filter((benefit) => !benefit.startsWith("Commission")),
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-[#4B5563]">
                      <Check className="h-4 w-4 text-[#2F7D32] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {seller && seed.name !== "FREE" && (
                  <Button
                    className="w-full mt-4 bg-[#2F7D32] hover:bg-[#256025]"
                    disabled={isCurrent || busy === tierKey}
                    onClick={() =>
                      void requestPlan({
                        ...plan,
                        tier: tierKey,
                        label: seed.displayName || seed.name,
                        priceFcfa: seed.name === "COOP_ENTERPRISE" ? null : seed.monthly_fee,
                      })
                    }
                  >
                    {busy === tierKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        {isCurrent ? "Plan actuel" : isPending ? "Rouvrir WhatsApp" : `Passer à ${seed.displayName || seed.name}`}
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
          priorité feed / affacturage). Paiement Mobile Money via WhatsApp — activation sous 24 h.
        </p>
      </main>
    </div>
  )
}
