"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Payout = {
  id: string
  seller_name: string
  amount_fcfa: number
  phone: string
  network: string
  status: string
  payout_reference: string | null
  admin_notes: string | null
  created_at: string
}

type Action = "paid" | "failed" | null
const PAGE_SIZE = 50

const STATUS_LABELS: Record<string, string> = {
  pending: "À traiter",
  processing: "En traitement",
  paid: "Versé",
  failed: "Échec",
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export default function ManualPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [filter, setFilter] = useState("pending")
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Payout | null>(null)
  const [action, setAction] = useState<Action>(null)
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/payouts?status=${filter}&limit=${PAGE_SIZE}&offset=${offset}`,
        { cache: "no-store" },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Impossible de charger la file.")
      setPayouts(data.payouts || [])
      setTotal(Number(data.total || 0))
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.")
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }, [filter, offset])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadPayouts(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadPayouts])

  const updateStatus = async (payout: Payout, status: "processing" | "paid" | "failed") => {
    if (status === "paid" || status === "failed") {
      setSelected(payout)
      setAction(status)
      setReference("")
      setNotes("")
      setError(null)
      return
    }
    await saveStatus(payout, status)
  }

  const saveStatus = async (payout: Payout, status: "processing" | "paid" | "failed") => {
    if (status === "paid" && !reference.trim()) {
      setError("La référence du versement est obligatoire.")
      return
    }
    if (status === "failed" && !notes.trim()) {
      setError("Indiquez le motif de l’échec.")
      return
    }
    setSavingId(payout.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          payout_reference: reference.trim(),
          notes: notes.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.")
      toast.success(
        status === "paid"
          ? "Versement enregistré comme payé."
          : status === "failed"
            ? "Échec enregistré ; le montant redevient disponible."
            : "Demande prise en charge.",
      )
      setSelected(null)
      setAction(null)
      if (offset === 0) await loadPayouts()
      else setOffset(0)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Mise à jour impossible.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Versements manuels</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Traitez les demandes après vérification et effectuez le paiement hors plateforme.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(value) => { setFilter(value); setOffset(0) }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">À traiter</SelectItem>
              <SelectItem value="processing">En traitement</SelectItem>
              <SelectItem value="paid">Versés</SelectItem>
              <SelectItem value="failed">Échecs</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void loadPayouts()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>File des demandes</CardTitle>
          <CardDescription>
            Marquer « versé » exige la référence réelle de la transaction. Aucun paiement n’est envoyé par cette interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Chargement des demandes…</p>
          ) : payouts.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Aucune demande dans cette file</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <article key={payout.id} className="flex flex-col justify-between gap-4 rounded-lg border p-4 lg:flex-row lg:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{payout.seller_name}</h2>
                      <Badge variant={payout.status === "paid" ? "default" : payout.status === "failed" ? "destructive" : "secondary"}>
                        {STATUS_LABELS[payout.status] || payout.status}
                      </Badge>
                    </div>
                    <p className="text-sm">{formatAmount(payout.amount_fcfa)} · {payout.network.replace("_ci", "").toUpperCase()} · {payout.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      Demande du {new Date(payout.created_at).toLocaleString("fr-FR")}
                    </p>
                    {payout.payout_reference && (
                      <p className="text-xs text-muted-foreground">Référence : {payout.payout_reference}</p>
                    )}
                    {payout.admin_notes && (
                      <p className="text-sm text-muted-foreground">Note : {payout.admin_notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {payout.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => void updateStatus(payout, "processing")}
                          disabled={savingId === payout.id}
                        >
                          <Clock3 className="mr-2 h-4 w-4" />
                          Prendre en charge
                        </Button>
                        <Button variant="destructive" onClick={() => void updateStatus(payout, "failed")}>
                          Signaler un échec
                        </Button>
                      </>
                    )}
                    {payout.status === "processing" && (
                      <>
                        <Button onClick={() => void updateStatus(payout, "paid")}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirmer le versement
                        </Button>
                        <Button variant="destructive" onClick={() => void updateStatus(payout, "failed")}>
                          Signaler un échec
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && total > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + payouts.length, total)} sur {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  disabled={offset + payouts.length >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected && !!action} onOpenChange={(open) => { if (!open) { setSelected(null); setAction(null); setError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "paid" ? "Confirmer le versement effectué" : "Signaler un échec"}</DialogTitle>
            <DialogDescription>
              {selected && `${selected.seller_name} · ${formatAmount(selected.amount_fcfa)} · ${selected.phone}`}
            </DialogDescription>
          </DialogHeader>
          {action === "paid" ? (
            <div className="space-y-2">
              <Label htmlFor="payout-reference">Référence réelle du paiement</Label>
              <Input id="payout-reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={128} required />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="payout-failure">Motif à communiquer au vendeur</Label>
              <Input id="payout-failure" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} required />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); setError(null) }}>Annuler</Button>
            <Button
              variant={action === "failed" ? "destructive" : "default"}
              disabled={!selected || savingId === selected.id}
              onClick={() => selected && action && void saveStatus(selected, action)}
            >
              {savingId === selected?.id ? "Enregistrement…" : action === "paid" ? "Enregistrer le versement" : "Enregistrer l’échec"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
