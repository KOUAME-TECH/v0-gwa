"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Banknote, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { isFactoringEligible } from "@/lib/factoring/eligibility"
import { ProducerSubnav } from "@/components/producer/producer-subnav"
import Link from "next/link"

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
  disbursed: { label: "Versée", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
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
      setError("Saisis un montant valide en FCFA")
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
    setSuccess("Demande envoyée. L’équipe GWA l’examinera bientôt.")
    setAmount("")
    setRequests((prev) => [data.request, ...prev])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24">
        <div className="container mx-auto px-4 py-8 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F5C2E]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24">
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <ProducerSubnav />
        <div className="mb-6">
          <h1 className="font-display text-3xl text-[#1F5C2E] flex items-center gap-2">
            <Banknote className="h-7 w-7" />
            Avance sur vente
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Demande de l’argent avant la fin de livraison, selon ton score de confiance.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-[#1F5C2E]/10 bg-white/90 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-[#1F5C2E]" />
            <p className="font-semibold text-[#1F5C2E]">Ton éligibilité</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6B7280]">Score de confiance</p>
              <p className="text-2xl font-bold tabular-nums">{profile?.scg_score ?? 0} / 1000</p>
            </div>
            {eligible ? (
              <Badge className="bg-green-100 text-green-700">Éligible</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700">Pas encore</Badge>
            )}
          </div>
          {!eligible && (
            <div className="mt-4 p-3 bg-[#FFF6E5] border border-[#1F5C2E]/15 rounded-xl flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-[#1F5C2E] mt-0.5 shrink-0" />
              <p className="text-[#374151]">
                Il te faut un score d’au moins 500. Livre bien, réponds aux messages —{" "}
                <Link href="/scg" className="font-medium text-[#1F5C2E] underline">
                  voir comment monter
                </Link>
                .
              </p>
            </div>
          )}
        </div>

        {eligible && (
          <div className="mb-8 rounded-2xl border border-[#1F5C2E]/10 bg-white/90 p-5 space-y-4">
            <div>
              <p className="font-semibold text-[#1F5C2E]">Nouvelle demande</p>
              <p className="text-sm text-[#6B7280]">Le montant est étudié à la main (bêta).</p>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
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
                className="rounded-xl"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-[#1F5C2E] hover:bg-[#184a25]"
            >
              {submitting ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        )}

        <h2 className="text-lg font-semibold text-[#1F5C2E] mb-3">Mes demandes</h2>
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1F5C2E]/20 bg-white/60 px-6 py-12 text-center">
            <Banknote className="h-10 w-10 mx-auto text-[#1F5C2E]/40 mb-3" />
            <p className="text-sm text-[#6B7280]">
              Aucune demande pour le moment. Améliore ton score ou publie pour créer des ventes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const meta = STATUS_META[req.status] || STATUS_META.pending
              const Icon = meta.icon
              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-[#1F5C2E]/10 bg-white/90 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold tabular-nums">{fcfa(req.amount_fcfa)}</p>
                      <p className="text-xs text-[#6B7280]">
                        Demandé{" "}
                        {formatDistanceToNow(new Date(req.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                        {req.scg_score_snapshot != null &&
                          ` · score ${req.scg_score_snapshot}`}
                      </p>
                    </div>
                    <Badge className={meta.className}>
                      <Icon className="h-3 w-3 mr-1" />
                      {meta.label}
                    </Badge>
                  </div>
                  {req.admin_notes && (
                    <p className="mt-3 text-sm text-[#6B7280] border-t border-[#F3F4F6] pt-3">
                      Note GWA : {req.admin_notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
