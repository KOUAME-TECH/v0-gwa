import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { subscriptionTierForPlan } from "@/lib/pricing/quote"

type PlanRow = {
  id: string
  name: string
  target: string
  switch_threshold: number | null
  next_plan_id: string | null
  is_active: boolean
}

export function abidjanPeriod(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
  }).format(now)
}

export function monthStartIso(period: string): string {
  return `${period}-01T00:00:00.000Z`
}

export async function monthlyDeliveredVolume(sellerId: string, period = abidjanPeriod()): Promise<number> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("orders")
    .select("subtotal, total_amount, delivered_at")
    .eq("seller_id", sellerId)
    .eq("status", "delivered")
    .gte("delivered_at", monthStartIso(period))

  if (error || !data) return 0
  return data.reduce((sum, row) => {
    const base = Number(row.subtotal ?? row.total_amount ?? 0)
    return sum + (Number.isFinite(base) ? base : 0)
  }, 0)
}

export type SwitchStatus = {
  eligible: boolean
  volume_fcfa: number
  threshold: number | null
  current_plan: string | null
  next_plan: { id: string; name: string } | null
  period: string
}

export async function evaluatePlanSwitch(sellerId: string): Promise<SwitchStatus> {
  const admin = createAdminClient()
  const period = abidjanPeriod()
  const empty: SwitchStatus = {
    eligible: false,
    volume_fcfa: 0,
    threshold: null,
    current_plan: null,
    next_plan: null,
    period,
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("pricing_plan_id, user_type")
    .eq("id", sellerId)
    .maybeSingle()
  if (!profile?.pricing_plan_id) return empty

  const { data: plan } = await admin
    .from("pricing_plans")
    .select("id, name, target, switch_threshold, next_plan_id, is_active")
    .eq("id", profile.pricing_plan_id)
    .maybeSingle()
  const current = plan as PlanRow | null
  if (!current) return empty

  const volume = await monthlyDeliveredVolume(sellerId, period)
  const base: SwitchStatus = {
    ...empty,
    volume_fcfa: volume,
    threshold: current.switch_threshold,
    current_plan: current.name,
  }
  if (!current.switch_threshold || !current.next_plan_id || volume <= current.switch_threshold) {
    return base
  }

  const { data: next } = await admin
    .from("pricing_plans")
    .select("id, name, target, is_active")
    .eq("id", current.next_plan_id)
    .maybeSingle()
  if (!next?.is_active || next.target !== current.target) return base

  const status: SwitchStatus = {
    ...base,
    eligible: true,
    next_plan: { id: next.id, name: next.name },
  }

  const { error: noticeError } = await admin.from("pricing_switch_notices").insert({
    seller_id: sellerId,
    plan_id: current.id,
    period,
  })
  if (!noticeError) {
    const thresholdLabel = new Intl.NumberFormat("fr-FR").format(current.switch_threshold)
    await admin.from("notifications").insert({
      user_id: sellerId,
      type: "pricing",
      title: "Un palier supérieur est disponible",
      message: `Félicitations ! Vous avez atteint ${thresholdLabel} F de ventes. Passez à ${next.name} pour économiser sur vos commissions.`,
      body: `Passez à ${next.name}`,
      link:
        profile?.user_type === "cooperative"
          ? "/dashboard/cooperative"
          : "/dashboard/farmer",
      is_read: false,
      read: false,
    })
  }

  return status
}

export async function applyPlanSwitch(sellerId: string, actorId: string) {
  const status = await evaluatePlanSwitch(sellerId)
  if (!status.eligible || !status.next_plan) {
    return { error: "Le seuil de bascule n'est pas atteint." as const }
  }
  const admin = createAdminClient()
  const tier = subscriptionTierForPlan(status.next_plan.name)
  const { data: before } = await admin
    .from("profiles")
    .select("pricing_plan_id, subscription_tier")
    .eq("id", sellerId)
    .maybeSingle()

  const { error } = await admin
    .from("profiles")
    .update({
      pricing_plan_id: status.next_plan.id,
      subscription_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerId)
  if (error) return { error: "Bascule impossible." as const }

  await admin.from("pricing_plan_audit").insert({
    plan_id: status.next_plan.id,
    actor_id: actorId,
    action: "seller_switch",
    before_state: before,
    after_state: { pricing_plan_id: status.next_plan.id, subscription_tier: tier },
  })

  await admin.from("notifications").insert({
    user_id: sellerId,
    type: "pricing",
    title: "Palier mis à jour",
    message: `Vous êtes passé à ${status.next_plan.name}. La nouvelle commission s'applique aux prochaines commandes.`,
    body: status.next_plan.name,
    link: "/abonnement",
    is_read: false,
    read: false,
  })

  return { plan: status.next_plan.name }
}
