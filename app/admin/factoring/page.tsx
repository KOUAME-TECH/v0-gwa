"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Banknote, Clock, CheckCircle2, XCircle, RefreshCw, User, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { canPerformAdminAction, isAdminRole, type AdminRole } from "@/lib/auth/admin-permissions"

interface Requester {
  id: string
  full_name: string | null
  phone: string | null
  city: string | null
  user_type: string | null
  scg_score: number | null
  scg_badge: string | null
  scg_bancable: boolean | null
}

interface FactoringRequest {
  id: string
  requester_id: string
  order_id: string | null
  amount_fcfa: number
  status: "pending" | "approved" | "rejected" | "disbursed"
  scg_score_snapshot: number | null
  scg_badge_snapshot: string | null
  admin_notes: string | null
  created_at: string
  decided_at: string | null
  requester?: Requester
}

function fcfa(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)) + " FCFA"
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approuvée", className: "bg-blue-100 text-blue-700" },
  disbursed: { label: "Décaissée", className: "bg-green-100 text-green-700" },
  rejected: { label: "Refusée", className: "bg-red-100 text-red-700" },
}

export default function AdminFactoringPage() {
  const [requests, setRequests] = useState<FactoringRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FactoringRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const [callerRole, setCallerRole] = useState<AdminRole | null>(null)

  useEffect(() => {
    void loadCallerRole()
    void load()
  }, [])

  async function loadCallerRole() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
    if (data?.role && isAdminRole(data.role)) {
      setCallerRole(data.role)
    }
  }

  async function load() {
    setLoading(true)
    const res = await fetch("/api/factoring?scope=all")
    const data = await res.json().catch(() => ({}))
    setRequests(data.requests || [])
    setLoading(false)
  }

  async function decide(action: "approve" | "reject" | "disburse") {
    if (!selected) return
    setProcessing(true)
    const res = await fetch(`/api/admin/factoring/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    })
    setProcessing(false)
    if (res.ok) {
      setSelected(null)
      setNotes("")
      await load()
    }
  }

  const pending = requests.filter((r) => r.status === "pending")
  const decided = requests.filter((r) => r.status !== "pending")
  const canDisburse = callerRole ? canPerformAdminAction(callerRole, "factoring_disburse") : false

  function renderCard(req: FactoringRequest) {
    const meta = STATUS_META[req.status] || STATUS_META.pending
    return (
      <Card key={req.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-[#2F7D32]/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-[#2F7D32]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{req.requester?.full_name || "Utilisateur"}</p>
                <Badge className={meta.className}>{meta.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {fcfa(req.amount_fcfa)} · SCG {req.scg_score_snapshot ?? "—"}
                {req.scg_badge_snapshot ? ` (${req.scg_badge_snapshot})` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: fr })}
                {req.requester?.city ? ` · ${req.requester.city}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected(req)
                setNotes(req.admin_notes || "")
              }}
            >
              Examiner
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-[#2F7D32]" />
            Affacturage
          </h1>
          <p className="text-muted-foreground">File des demandes de financement (semi-manuel)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/admin/export?entity=factoring" download>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </a>
          </Button>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pending.length}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {requests.filter((r) => r.status === "approved" || r.status === "disbursed").length}
              </p>
              <p className="text-sm text-muted-foreground">Approuvées / décaissées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{requests.filter((r) => r.status === "rejected").length}</p>
              <p className="text-sm text-muted-foreground">Refusées</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">En attente ({pending.length})</TabsTrigger>
          <TabsTrigger value="decided">Traitées ({decided.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-6 space-y-3">
          {pending.length === 0 ? (
            <Card className="p-12 text-center">
              <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune demande en attente</p>
            </Card>
          ) : (
            pending.map(renderCard)
          )}
        </TabsContent>
        <TabsContent value="decided" className="mt-6 space-y-3">
          {decided.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Aucune demande traitée</p>
            </Card>
          ) : (
            decided.map(renderCard)
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande d'affacturage</DialogTitle>
            <DialogDescription>Décision semi-manuelle — aucun décaissement automatique.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-1">
                <p className="font-semibold">{selected.requester?.full_name || "Utilisateur"}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.requester?.phone || "—"} · {selected.requester?.city || "—"}
                </p>
                <p className="text-2xl font-bold mt-2">{fcfa(selected.amount_fcfa)}</p>
                <p className="text-sm">
                  SCG (snapshot) : <strong>{selected.scg_score_snapshot ?? "—"}</strong>
                  {selected.scg_badge_snapshot ? ` · ${selected.scg_badge_snapshot}` : ""}
                </p>
                {selected.order_id && (
                  <p className="text-xs text-muted-foreground">Commande liée : {selected.order_id}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes admin</label>
                <Textarea
                  placeholder="Motif de la décision, conditions, montant accordé..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Fermer
            </Button>
            {selected?.status === "pending" && (
              <>
                <Button variant="destructive" onClick={() => decide("reject")} disabled={processing}>
                  Refuser
                </Button>
                <Button onClick={() => decide("approve")} disabled={processing}>
                  Approuver
                </Button>
              </>
            )}
            {selected?.status === "approved" && canDisburse && (
              <Button onClick={() => decide("disburse")} disabled={processing} className="bg-green-600 hover:bg-green-700">
                Marquer décaissée
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
