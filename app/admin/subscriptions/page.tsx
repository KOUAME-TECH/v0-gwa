"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Crown, Check, Copy, Search, Phone } from "lucide-react"
import { ConfirmDestructive } from "@/components/ui/confirm-destructive"
import {
  TIER_LABELS_FR,
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"

type SubRequest = {
  id: string
  user_id: string
  requested_tier: string
  current_tier: string | null
  amount_fcfa: number | null
  status: string
  note: string | null
  created_at: string
  profile?: {
    full_name?: string
    phone?: string
    user_type?: string
    subscription_tier?: string
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  activated: "Activées",
  rejected: "Rejetées",
  all: "Toutes",
}

const TIER_FILTERS: Array<"all" | SubscriptionTier> = [
  "all",
  "starter",
  "pro",
  "enterprise",
]

export default function AdminSubscriptionsPage() {
  const [requests, setRequests] = useState<SubRequest[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState("pending")
  const [tierFilter, setTierFilter] = useState<"all" | SubscriptionTier>("all")
  const [q, setQ] = useState("")
  const [qApplied, setQApplied] = useState("")

  const [manualPhone, setManualPhone] = useState("")
  const [manualTier, setManualTier] = useState<SubscriptionTier>("starter")
  const [manualBusy, setManualBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: filter })
      if (tierFilter !== "all") params.set("tier", tierFilter)
      if (qApplied) params.set("q", qApplied)
      const res = await fetch(`/api/admin/subscriptions?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Chargement impossible")
        setRequests([])
      } else {
        setRequests(data.requests || [])
        setCounts(data.counts || {})
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setLoading(false)
  }, [filter, tierFilter, qApplied])

  useEffect(() => {
    void load()
  }, [load])

  async function activate(id: string) {
    setBusy(id)
    try {
      const res = await fetch("/api/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Activation échouée")
      } else {
        toast.success("Abonnement activé")
        void load()
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setBusy(null)
  }

  async function reject(id: string) {
    setBusy(id)
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: id, action: "reject" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Rejet impossible")
      } else {
        toast.success("Demande rejetée")
        void load()
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setBusy(null)
  }

  async function activateManual() {
    if (!manualPhone.trim()) {
      toast.error("Indiquez un téléphone")
      return
    }
    setManualBusy(true)
    try {
      const res = await fetch("/api/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: manualPhone.trim(),
          tier: manualTier,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Activation manuelle impossible")
      } else {
        toast.success(
          `Palier ${TIER_LABELS_FR[normalizeSubscriptionTier(data.tier)]} activé`,
        )
        setManualPhone("")
        void load()
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setManualBusy(false)
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copié`),
      () => toast.error("Copie impossible"),
    )
  }

  function tierLabel(raw: string | null | undefined) {
    if (!raw) return "—"
    return TIER_LABELS_FR[normalizeSubscriptionTier(raw)] || raw
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-[#C27D10]" />
          Abonnements vendeurs
        </h1>
        <p className="text-muted-foreground text-sm">
          Traitez les demandes après preuve WhatsApp, ou activez manuellement par
          téléphone. Le backoffice est distinct du compte métier du vendeur.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["pending", "En attente"],
            ["activated", "Activées"],
            ["rejected", "Rejetées"],
          ] as const
        ).map(([key, label]) => (
          <Card
            key={key}
            className={
              filter === key ? "border-[#1F5C2E] ring-1 ring-[#1F5C2E]/30" : ""
            }
          >
            <CardContent className="p-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setFilter(key)}
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold tabular-nums">
                  {counts[key] ?? "—"}
                </p>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Activation manuelle
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Téléphone vendeur
            </label>
            <Input
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="+22507… ou 07…"
              inputMode="tel"
            />
          </div>
          <div className="sm:w-40 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Palier
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={manualTier}
              onChange={(e) =>
                setManualTier(normalizeSubscriptionTier(e.target.value))
              }
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Entreprise</option>
            </select>
          </div>
          <Button
            className="bg-[#1F5C2E] hover:bg-[#174824]"
            disabled={manualBusy}
            onClick={() => void activateManual()}
          >
            Activer
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQApplied(q.trim())
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, téléphone ou ID utilisateur"
            />
          </div>
          <Button type="submit" variant="secondary">
            Chercher
          </Button>
          {qApplied ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQ("")
                setQApplied("")
              }}
            >
              Effacer
            </Button>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-2">
          {(["pending", "activated", "rejected", "all"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
            >
              {STATUS_LABELS[s]}
              {s !== "all" && counts[s] != null ? ` (${counts[s]})` : ""}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {TIER_FILTERS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tierFilter === t ? "secondary" : "ghost"}
              onClick={() => setTierFilter(t)}
            >
              {t === "all" ? "Tous paliers" : TIER_LABELS_FR[t]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune demande ({STATUS_LABELS[filter] || filter})
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">
                    {r.profile?.full_name || "Sans nom"}
                  </span>
                  <Badge variant="secondary">
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Demande{" "}
                    <strong className="text-foreground">
                      {tierLabel(r.requested_tier)}
                    </strong>
                    {r.current_tier
                      ? ` (actuel : ${tierLabel(r.current_tier)})`
                      : ""}
                    {r.profile?.subscription_tier
                      ? ` · profil : ${tierLabel(r.profile.subscription_tier)}`
                      : ""}
                  </p>
                  {r.amount_fcfa != null ? (
                    <p>
                      Montant :{" "}
                      {new Intl.NumberFormat("fr-FR").format(r.amount_fcfa)}{" "}
                      FCFA
                    </p>
                  ) : null}
                  {r.profile?.user_type ? (
                    <p>Rôle : {r.profile.user_type}</p>
                  ) : null}
                  {r.profile?.phone ? (
                    <p className="flex items-center gap-2 flex-wrap">
                      <span>Tél. {r.profile.phone}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() =>
                          copyText(r.profile!.phone!, "Téléphone")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </p>
                  ) : null}
                  <p className="text-xs flex items-center gap-2 flex-wrap">
                    <span>
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </span>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => copyText(r.user_id, "ID utilisateur")}
                    >
                      ID {r.user_id.slice(0, 8)}…
                    </button>
                  </p>
                  {r.note ? (
                    <p className="text-xs italic">Note : {r.note}</p>
                  ) : null}
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-[#1F5C2E] hover:bg-[#174824]"
                      disabled={busy === r.id}
                      onClick={() => void activate(r.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Activer
                    </Button>
                    <ConfirmDestructive
                      triggerLabel="Rejeter"
                      title="Rejeter cette demande ?"
                      description={`Le palier ${tierLabel(r.requested_tier)} ne sera pas activé pour ${r.profile?.full_name || "cet utilisateur"}.`}
                      confirmLabel="Rejeter"
                      disabled={busy === r.id}
                      onConfirm={() => void reject(r.id)}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
