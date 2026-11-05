"use client"

import Link from "next/link"
import { compareSoloToCoop, memberShareFcfa } from "@/lib/pricing/coop-advantage"
import { loadPricingPlans } from "@/lib/pricing/load-plans"
import { seedPlan } from "@/lib/pricing/published-grid"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useMemo, useState } from "react"

function money(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value)
}

export function CoopFeeShare({
  monthlyFee,
  activeMembers,
  planName,
}: {
  monthlyFee: number
  activeMembers: number
  planName: string
}) {
  const share = memberShareFcfa(monthlyFee, activeMembers)
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <h3 className="text-base font-semibold text-[#111827]">Cotisation des membres</h3>
      <p className="mt-1 text-sm text-[#4B5563]">
        L’abonnement {planName} est de {money(monthlyFee)} F par mois. Il est partagé entre les membres actifs.
      </p>
      <p className="mt-3 text-2xl font-bold text-[#1F5C2E]">
        {activeMembers > 0 ? `${money(share)} F` : `${money(monthlyFee)} F`}
        <span className="ml-1 text-sm font-medium text-[#6B7280]">par membre / mois</span>
      </p>
      <p className="mt-2 text-sm text-[#4B5563]">
        {activeMembers > 0
          ? `${activeMembers} membre${activeMembers > 1 ? "s" : ""} actif${activeMembers > 1 ? "s" : ""}. Chacun voit cette part sur son tableau de bord.`
          : "Invite des producteurs pour répartir cet abonnement."}
      </p>
    </section>
  )
}

export function CoopJoinSimulator({ ctaHref = "/cooperatives" }: { ctaHref?: string }) {
  const [revenue, setRevenue] = useState(1_000_000)
  const [solo, setSolo] = useState(() => seedPlan("STARTER"))
  const [coop, setCoop] = useState(() => seedPlan("COOP_START"))

  useEffect(() => {
    void loadPricingPlans().then((plans) => {
      const nextSolo = plans.find((plan) => plan.name === "STARTER" || plan.displayName === "Pousse")
      const nextCoop = plans.find((plan) => plan.name === "COOP_START" || plan.displayName === "Coopérative")
      if (nextSolo) setSolo(nextSolo)
      if (nextCoop) setCoop(nextCoop)
    })
  }, [])

  const result = useMemo(
    () => compareSoloToCoop({ monthlyRevenue: revenue, solo, coop, activeMembers: 10 }),
    [revenue, solo, coop],
  )
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <h2 className="text-base font-semibold text-[#111827]">Pourquoi rejoindre une coopérative ?</h2>
      <p className="mt-1 text-sm text-[#4B5563]">
        Exemple pour une coopérative de 10 membres, plan {coop.displayName || "Coopérative"}.
      </p>
      <label className="mt-3 block text-sm font-medium text-[#111827]" htmlFor="ca-mensuel">
        Ton chiffre d’affaires mensuel estimé
      </label>
      <input
        id="ca-mensuel"
        inputMode="numeric"
        className="mt-1 h-11 w-full rounded-xl border border-[#E5E7EB] px-3 text-base"
        value={revenue}
        onChange={(event) => setRevenue(Math.max(0, Math.round(Number(event.target.value) || 0)))}
      />
      <div className="mt-3 space-y-2 text-sm text-[#111827]">
        <p>
          Seul, plan {solo.displayName} ({Math.round(solo.commission_rate * 100)} %) :{" "}
          {money(result.soloCommission)} F de commission + {money(result.soloFee)} F d’abonnement ={" "}
          <strong>{money(result.soloTotal)} F</strong>
        </p>
        <p>
          Dans une coopérative ({Math.round(coop.commission_rate * 100)} % + partage {money(result.memberShare)} F) :{" "}
          {money(result.coopCommission)} F + {money(result.memberShare)} F ={" "}
          <strong>{money(result.coopTotal)} F</strong>
        </p>
        <p className="text-base font-semibold text-[#1F5C2E]">
          Gain estimé : {money(result.monthlyGain)} F par mois.
        </p>
      </div>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#1F5C2E] px-4 text-sm font-semibold text-white"
      >
        Découvrir les coopératives
      </Link>
    </section>
  )
}

export function MemberCoopShare({
  coopName,
  monthlyFee,
  activeMembers,
}: {
  coopName: string
  monthlyFee: number
  activeMembers: number
}) {
  const share = memberShareFcfa(monthlyFee, Math.max(activeMembers, 1))
  return (
    <section className="rounded-2xl bg-[#F4F8F4] p-4 ring-1 ring-[#1F5C2E]/15">
      <h2 className="text-base font-semibold text-[#111827]">Ta part dans {coopName}</h2>
      <p className="mt-2 text-2xl font-bold text-[#1F5C2E]">{money(share)} F / mois</p>
      <p className="mt-1 text-sm text-[#4B5563]">
        L’abonnement de la coopérative est de {money(monthlyFee)} F, partagé entre {Math.max(activeMembers, 1)} membres.
      </p>
    </section>
  )
}

export function CoopFeeShareLive({ activeMembers }: { activeMembers: number }) {
  const fallback = seedPlan("COOP_START")
  const [monthlyFee, setMonthlyFee] = useState(fallback.monthly_fee)
  const [planName, setPlanName] = useState(fallback.displayName || "Coopérative")

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("pricing_plans")
      .select("name, monthly_fee")
      .eq("code", "COOP_START")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setMonthlyFee(Number(data.monthly_fee) || 0)
        if (data.name) setPlanName(String(data.name))
      })
  }, [])

  return <CoopFeeShare monthlyFee={monthlyFee} activeMembers={activeMembers} planName={planName} />
}
