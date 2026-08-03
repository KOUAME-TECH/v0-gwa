"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Banknote, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { isFactoringEligible } from "@/lib/factoring/eligibility"

interface FactoringRequest {
  id: string
  amount_fcfa: number
  status: "pending" | "approved" | "rejected" | "disbursed"
  scg_score_snapshot: number | null
  scg_badge_snapshot: string | null
  admin_notes: string | null
  created_at: string
  decided_at: string | null
}

function fcfa(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)) + " FCFA"
}

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approuvée", className: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  disbursed: { label: "Décaissée", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Refusée", className: "bg-red-100 text-red-700", icon: XCircle },
}

export default function AffacturagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ scg_score: number; scg_bancable: boolean; scg_badge: string } | null>(null)
  const [requests, setRequests] = useState<FactoringRequest[]>([])
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const eligible = isFactoringEligible(profile)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const meRes = await fetch("/api/auth/me")
    if (meRes.status === 401) {
      router.replace("/auth/login?redirect=/affacturage")
      return
    }
    const me = await meRes.json().catch(() => ({}))
    setProfile({
      scg_score: me?.profile?.scg_score ?? 0,
      scg_bancable: me?.profile?.scg_bancable ?? false,
      scg_badge: me?.profile?.scg_badge ?? "insuffisant",
    })

    const res = await fetch("/api/factoring")
    const data = await res.json().catch(() => ({}))
    setRequests(data.requests || [])
    setLoading(false)
  }

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    const value = Number(amount.replace(/\s/g, ""))
    if (!Number.isFinite(value) || value <= 0) {
      setError("Veuillez saisir un montant valide en FCFA")
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/factoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_fcfa: value }),
    })
    const data = await res.json().catch(() => ({}))
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error || "Échec de la demande")
      return
    }
    setSuccess("Demande envoyée. Un administrateur GWA l'examinera.")
    setAmount("")
    setRequests((prev) => [data.request, ...prev])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Banknote className="h-7 w-7 text-[#2F7D32]" />
            Affacturage
          </h1>
          <p className="text-muted-foreground">
            Obtenez une avance de trésorerie sur vos ventes, adossée à votre Score de Confiance GWA (SCG).
          </p>
        </div>

        {/* Éligibilité SCG */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#2F7D32]" />
              Votre éligibilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score SCG</p>
                <p className="text-2xl font-bold">{profile?.scg_score ?? 0} / 1000</p>
              </div>
              {eligible ? (
                <Badge className="bg-green-100 text-green-700">Éligible</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700">Non éligible</Badge>
              )}
            </div>
            {!eligible && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-blue-700">
                  Un score SCG d'au moins 500 (profil bancable) est requis. Réalisez plus de
                  transactions et améliorez vos indicateurs pour devenir éligible.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulaire de demande */}
        {eligible && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Nouvelle demande</CardTitle>
              <CardDescription>Le montant sera étudié manuellement par GWA (bêta).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}
              <div className="space-y-2">
                <Label>Montant souhaité (FCFA)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                />
              </div>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Envoi..." : "Envoyer la demande"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Liste des demandes */}
        <h2 className="text-xl font-bold mb-4">Mes demandes</h2>
        {requests.length === 0 ? (
          <Card className="p-10 text-center">
            <Banknote className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune demande d'affacturage pour le moment.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const meta = STATUS_META[req.status] || STATUS_META.pending
              const Icon = meta.icon
              return (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold">{fcfa(req.amount_fcfa)}</p>
                        <p className="text-xs text-muted-foreground">
                          Demandé {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: fr })}
                          {req.scg_score_snapshot != null && ` · SCG ${req.scg_score_snapshot}`}
                        </p>
                      </div>
                      <Badge className={meta.className}>
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                    {req.admin_notes && (
                      <p className="mt-3 text-sm text-muted-foreground border-t pt-3">
                        Note GWA : {req.admin_notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
