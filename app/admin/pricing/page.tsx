"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { simulateMargin, type PricingPlanInput, type PricingTarget } from "@/lib/pricing/quote"

type Plan = PricingPlanInput & {
  id: string
  is_active: boolean
  next_plan_id: string | null
}

type Settings = {
  aggregator_rate: number
  aggregator_fixed: number
  margin_alert_fcfa: number
}

type AuditRow = {
  id: string
  action: string
  created_at: string
  before_state: unknown
  after_state: unknown
}

const PRESETS = [30_000, 100_000, 500_000]
const EMPTY_SETTINGS: Settings = {
  aggregator_rate: 0.03,
  aggregator_fixed: 50,
  margin_alert_fcfa: 2000,
}

function money(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n))
}

function PlanEditor({
  plan,
  onSaved,
}: {
  plan: Plan
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(plan)
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(plan), [plan])

  async function save() {
    setBusy(true)
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: plan.id,
        patch: {
          monthly_fee: draft.monthly_fee,
          commission_rate: draft.commission_rate,
          buyer_service_fee_fixed: draft.buyer_service_fee_fixed,
          buyer_service_fee_rate: draft.buyer_service_fee_rate,
          franchise_threshold: draft.franchise_threshold,
          franchise_cap: draft.franchise_cap,
          switch_threshold: draft.switch_threshold,
          is_active: draft.is_active,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      toast.error(data.error || "Enregistrement impossible")
      return
    }
    toast.success(`${plan.name} enregistré`)
    onSaved()
  }

  return (
    <div className="rounded-2xl border border-[#1F5C2E]/15 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#1F5C2E]">{plan.name}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          />
          Active
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Abonnement (FCFA / mois)" value={draft.monthly_fee} onChange={(value) => setDraft({ ...draft, monthly_fee: Number(value) || 0 })} />
        <Field
          label="Commission (ex. 0,08)"
          value={draft.commission_rate}
          step="0.0001"
          onChange={(value) => setDraft({ ...draft, commission_rate: Number(value) || 0 })}
        />
        <Field label="Frais acheteur fixes" value={draft.buyer_service_fee_fixed} onChange={(value) => setDraft({ ...draft, buyer_service_fee_fixed: Number(value) || 0 })} />
        <Field
          label="Frais acheteur (taux)"
          value={draft.buyer_service_fee_rate}
          step="0.0001"
          onChange={(value) => setDraft({ ...draft, buyer_service_fee_rate: Number(value) || 0 })}
        />
        <Field label="Seuil franchise" value={draft.franchise_threshold} onChange={(value) => setDraft({ ...draft, franchise_threshold: Number(value) || 0 })} />
        <Field label="Plafond franchise" value={draft.franchise_cap} onChange={(value) => setDraft({ ...draft, franchise_cap: Number(value) || 0 })} />
        <Field
          label="Seuil de bascule (vide = aucun)"
          value={draft.switch_threshold ?? ""}
          onChange={(switch_threshold) =>
            setDraft({
              ...draft,
              switch_threshold: switch_threshold === "" ? null : Number(switch_threshold),
            })
          }
        />
      </div>
      <Button className="mt-3" disabled={busy} onClick={save}>
        Enregistrer
      </Button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: number | string | null
  step?: string
  onChange: (value: number | "") => void
}) {
  return (
    <label className="block text-xs text-[#4B5563]">
      {label}
      <Input
        className="mt-1"
        type="number"
        step={step || "1"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </label>
  )
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [basket, setBasket] = useState(100_000)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pricing")
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || "Grille indisponible")
      return
    }
    setError("")
    setPlans(data.plans || [])
    if (data.settings) setSettings(data.settings)
    setAudit(data.audit || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    return (["producer", "cooperative"] as PricingTarget[]).map((target) => ({
      target,
      title: target === "producer" ? "Producteurs solo" : "Coopératives",
      plans: plans.filter((plan) => plan.target === target),
    }))
  }, [plans])

  async function saveSettings() {
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "Paramètres non enregistrés")
      return
    }
    toast.success("Paramètres du simulateur enregistrés")
    void load()
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1F5C2E]">Grilles tarifaires</h1>
        <p className="mt-1 text-sm text-[#4B5563]">
          Producteurs et coopératives. Chaque commande lit ces valeurs. Une offre désactivée
          renvoie vers Graine ou Coopérative.
        </p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {groups.map((group) => (
        <section key={group.target} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          {group.plans.map((plan) => (
            <PlanEditor key={plan.id} plan={plan} onSaved={load} />
          ))}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Simulateur de marge</h2>
        <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-4">
          <Field label="Panier à tester" value={basket} onChange={(value) => setBasket(Number(value) || 0)} />
          <Field
            label="Taux agrégateur"
            value={settings.aggregator_rate}
            step="0.0001"
            onChange={(aggregator_rate) => setSettings({ ...settings, aggregator_rate: Number(aggregator_rate) })}
          />
          <Field
            label="Fixe agrégateur"
            value={settings.aggregator_fixed}
            onChange={(aggregator_fixed) => setSettings({ ...settings, aggregator_fixed: Number(aggregator_fixed) })}
          />
          <Field
            label="Alerte si marge sous"
            value={settings.margin_alert_fcfa}
            onChange={(margin_alert_fcfa) =>
              setSettings({ ...settings, margin_alert_fcfa: Number(margin_alert_fcfa) })
            }
          />
        </div>
        <Button variant="secondary" onClick={saveSettings}>
          Enregistrer les paramètres du simulateur
        </Button>
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F7F4EE] text-xs uppercase text-[#4B5563]">
              <tr>
                <th className="px-3 py-2">Offre</th>
                <th className="px-3 py-2">Panier</th>
                <th className="px-3 py-2">Commission</th>
                <th className="px-3 py-2">Frais acheteur</th>
                <th className="px-3 py-2">Total payé</th>
                <th className="px-3 py-2">Agrégateur</th>
                <th className="px-3 py-2">Marge nette</th>
              </tr>
            </thead>
            <tbody>
              {plans.flatMap((plan) =>
                [...PRESETS, basket].filter((value, index, all) => all.indexOf(value) === index).map((amount) => {
                  const row = simulateMargin(plan, amount, {
                    rate: Number(settings.aggregator_rate),
                    fixed: Number(settings.aggregator_fixed),
                    alertBelow: Number(settings.margin_alert_fcfa),
                  })
                  return (
                    <tr key={`${plan.id}-${amount}`} className="border-t">
                      <td className="px-3 py-2 font-medium">{plan.name}</td>
                      <td className="px-3 py-2">{money(amount)}</td>
                      <td className="px-3 py-2">{money(row.seller_commission)}</td>
                      <td className="px-3 py-2">{money(row.buyer_service_fee)}</td>
                      <td className="px-3 py-2">{money(row.total_amount)}</td>
                      <td className="px-3 py-2">{money(row.aggregator_fee)}</td>
                      <td className={`px-3 py-2 font-semibold ${row.margin_alert ? "text-red-700" : "text-[#1F5C2E]"}`}>
                        {money(row.gwa_net_margin)}
                        {row.margin_alert ? " — sous le seuil" : ""}
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Historique</h2>
        <ul className="space-y-2 text-sm">
          {audit.map((row) => (
            <li key={row.id} className="rounded-xl border bg-white px-3 py-2">
              <span className="font-medium">{row.action}</span>
              <span className="ml-2 text-[#6B7280]">
                {new Date(row.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}
              </span>
            </li>
          ))}
          {audit.length === 0 ? <li className="text-[#6B7280]">Aucune modification enregistrée.</li> : null}
        </ul>
      </section>
    </div>
  )
}
