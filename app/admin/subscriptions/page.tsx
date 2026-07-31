"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Crown, Check } from "lucide-react"
import { ConfirmDestructive } from "@/components/ui/confirm-destructive"

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

export default function AdminSubscriptionsPage() {
  const [requests, setRequests] = useState<SubRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState("pending")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/subscriptions?status=${filter}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Chargement impossible")
        setRequests([])
      } else {
        setRequests(data.requests || [])
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setLoading(false)
  }, [filter])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-[#C27D10]" />
          Demandes d’abonnement
        </h1>
        <p className="text-muted-foreground text-sm">
          Activer après preuve de paiement WhatsApp, ou rejeter.
        </p>
      </div>

      <div className="flex gap-2">
        {["pending", "activated", "rejected", "all"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune demande ({filter})
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>
                    {r.profile?.full_name || r.user_id.slice(0, 8)}
                  </span>
                  <Badge variant="secondary">{r.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Demande <strong className="text-foreground">{r.requested_tier}</strong>
                    {r.current_tier ? ` (actuel : ${r.current_tier})` : ""}
                  </p>
                  {r.amount_fcfa != null ? (
                    <p>
                      Montant :{" "}
                      {new Intl.NumberFormat("fr-FR").format(r.amount_fcfa)} FCFA
                    </p>
                  ) : null}
                  {r.profile?.phone ? <p>Tél. {r.profile.phone}</p> : null}
                  <p className="text-xs">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </p>
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
                      description={`Le palier ${r.requested_tier} ne sera pas activé pour ${r.profile?.full_name || "cet utilisateur"}.`}
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
