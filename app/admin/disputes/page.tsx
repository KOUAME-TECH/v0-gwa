"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle, Clock, CheckCircle2, XCircle, Eye, Search,
  MessageSquare, Package, DollarSign, RefreshCw, FileText,
  ArrowRight, ImageIcon, User
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface Dispute {
  id: string
  order_id: string
  opened_by: string
  reason: string
  description: string
  evidence_urls: { type: string; url: string }[] | null
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  resolution: string | null
  refund_amount: number | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  orders?: {
    order_number: string
    total_amount: number
    status: string
    buyer_id: string
    seller_id: string
  }
  opener?: {
    full_name: string
    email: string
    avatar_url: string | null
  }
  assignee?: {
    full_name: string
  }
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [processing, setProcessing] = useState(false)
  const [resolution, setResolution] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [newStatus, setNewStatus] = useState<string>("")
  const [escrowOutcome, setEscrowOutcome] = useState<string>("release_seller")
  
  const supabase = createClient()

  useEffect(() => {
    loadDisputes()
  }, [])

  async function loadDisputes() {
    setLoading(true)
    
    const { data } = await supabase
      .from('disputes')
      .select(`
        *,
        orders:order_id (order_number, total_amount, status, buyer_id, seller_id),
        opener:opened_by (full_name, email, avatar_url),
        assignee:assigned_to (full_name)
      `)
      .order('created_at', { ascending: false })

    if (data) {
      setDisputes(data as Dispute[])
    }
    setLoading(false)
  }

  async function handleUpdateDispute(dispute: Dispute) {
    if (!newStatus) return
    
    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolution: resolution || null,
          refund_amount: refundAmount || null,
          escrow_outcome:
            newStatus === "resolved" || newStatus === "closed"
              ? escrowOutcome
              : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Mise à jour impossible")
        setProcessing(false)
        return
      }

      setSelectedDispute(null)
      setResolution("")
      setRefundAmount("")
      setNewStatus("")
      setEscrowOutcome("release_seller")
      await loadDisputes()
    } catch {
      alert("Erreur réseau")
    }
    setProcessing(false)
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Ouvert'
      case 'under_review': return 'En cours d\'examen'
      case 'resolved': return 'Résolu'
      case 'closed': return 'Fermé'
      default: return status
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-red-100 text-red-700">Ouvert</Badge>
      case 'under_review':
        return <Badge className="bg-yellow-100 text-yellow-700">En examen</Badge>
      case 'resolved':
        return <Badge className="bg-green-100 text-green-700">Résolu</Badge>
      case 'closed':
        return <Badge className="bg-gray-100 text-gray-700">Fermé</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      'product_not_received': 'Produit non reçu',
      'product_damaged': 'Produit endommagé',
      'wrong_product': 'Mauvais produit',
      'quality_issue': 'Problème de qualité',
      'quantity_issue': 'Problème de quantité',
      'other': 'Autre'
    }
    return reasons[reason] || reason
  }

  const filteredDisputes = disputes.filter(d => {
    const searchLower = searchQuery.toLowerCase()
    return (
      d.orders?.order_number?.toLowerCase().includes(searchLower) ||
      d.opener?.full_name?.toLowerCase().includes(searchLower) ||
      d.opener?.email?.toLowerCase().includes(searchLower)
    )
  })

  const openCount = disputes.filter(d => d.status === 'open').length
  const underReviewCount = disputes.filter(d => d.status === 'under_review').length
  const resolvedCount = disputes.filter(d => d.status === 'resolved' || d.status === 'closed').length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Litiges</h1>
          <p className="text-muted-foreground">Gérer les litiges entre acheteurs et vendeurs</p>
        </div>
        <Button variant="outline" onClick={loadDisputes}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{disputes.length}</p>
              <p className="text-sm text-muted-foreground">Total litiges</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-sm text-muted-foreground">Ouverts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{underReviewCount}</p>
              <p className="text-sm text-muted-foreground">En examen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">Résolus</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par numéro de commande, nom..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Ouverts ({openCount})</TabsTrigger>
          <TabsTrigger value="under_review">En examen ({underReviewCount})</TabsTrigger>
          <TabsTrigger value="resolved">Résolus ({resolvedCount})</TabsTrigger>
          <TabsTrigger value="all">Tous ({disputes.length})</TabsTrigger>
        </TabsList>

        {['open', 'under_review', 'resolved', 'all'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {filteredDisputes.filter(d => 
              tab === 'all' || 
              d.status === tab ||
              (tab === 'resolved' && (d.status === 'resolved' || d.status === 'closed'))
            ).length === 0 ? (
              <Card className="p-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun litige</h3>
                <p className="text-muted-foreground">
                  Les litiges apparaîtront ici
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDisputes
                  .filter(d => 
                    tab === 'all' || 
                    d.status === tab ||
                    (tab === 'resolved' && (d.status === 'resolved' || d.status === 'closed'))
                  )
                  .map(dispute => (
                    <Card key={dispute.id} className={`hover:shadow-md transition-shadow ${
                      dispute.status === 'open' ? 'border-red-200' : ''
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={dispute.opener?.avatar_url || ""} />
                            <AvatarFallback>
                              {dispute.opener?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">
                                Commande {dispute.orders?.order_number}
                              </p>
                              {getStatusBadge(dispute.status)}
                            </div>
                            <p className="text-sm font-medium text-red-600 mb-1">
                              {getReasonLabel(dispute.reason)}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {dispute.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {dispute.opener?.full_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {dispute.orders?.total_amount?.toLocaleString()} FCFA
                              </span>
                              <span>
                                {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true, locale: fr })}
                              </span>
                              {dispute.assignee && (
                                <span className="text-blue-600">
                                  Assigné à {dispute.assignee.full_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedDispute(dispute)
                              setNewStatus(dispute.status)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Examiner
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={() => setSelectedDispute(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Examiner le litige</DialogTitle>
            <DialogDescription>
              Commande {selectedDispute?.orders?.order_number}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDispute && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Dispute Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4 mb-3">
                    <Avatar>
                      <AvatarImage src={selectedDispute.opener?.avatar_url || ""} />
                      <AvatarFallback>
                        {selectedDispute.opener?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedDispute.opener?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedDispute.opener?.email}</p>
                    </div>
                  </div>
                  <Badge variant="destructive" className="mb-2">
                    {getReasonLabel(selectedDispute.reason)}
                  </Badge>
                  <p className="text-sm">{selectedDispute.description}</p>
                </div>

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Montant commande</p>
                    <p className="font-bold text-lg">
                      {selectedDispute.orders?.total_amount?.toLocaleString()} FCFA
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut commande</p>
                    <Badge variant="outline">{selectedDispute.orders?.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date d'ouverture</p>
                    <p>{new Date(selectedDispute.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut actuel</p>
                    {getStatusBadge(selectedDispute.status)}
                  </div>
                </div>

                {/* Evidence */}
                {selectedDispute.evidence_urls && selectedDispute.evidence_urls.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Preuves fournies</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedDispute.evidence_urls.map((evidence, index) => (
                        <a 
                          key={index}
                          href={evidence.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden border hover:opacity-80"
                        >
                          {evidence.type.startsWith('image') ? (
                            <img 
                              src={evidence.url || "/placeholder.svg"} 
                              alt={`Preuve ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution */}
                {(selectedDispute.status === 'resolved' || selectedDispute.status === 'closed') && selectedDispute.resolution && (
                  <div>
                    <h4 className="font-semibold mb-2">Resolution</h4>
                    <p className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                      {selectedDispute.resolution}
                    </p>
                    {selectedDispute.refund_amount && (
                      <p className="mt-2 text-sm">
                        Remboursement: <strong>{selectedDispute.refund_amount.toLocaleString()} FCFA</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Update Form */}
                {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-semibold">Mettre a jour le litige</h4>
                    
                    <div className="space-y-2">
                      <Label>Nouveau statut</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionnez un statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Ouvert</SelectItem>
                          <SelectItem value="under_review">En examen</SelectItem>
                          <SelectItem value="resolved">Resolu</SelectItem>
                          <SelectItem value="closed">Ferme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(newStatus === 'resolved' || newStatus === 'closed') && (
                      <>
                        <div className="space-y-2">
                          <Label>Resolution</Label>
                          <Textarea
                            placeholder="Decrivez la resolution du litige..."
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Montant du remboursement (optionnel)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            max={selectedDispute.orders?.total_amount}
                          />
                          <p className="text-xs text-muted-foreground">
                            Maximum: {selectedDispute.orders?.total_amount?.toLocaleString()} FCFA
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Issue escrow</Label>
                          <Select value={escrowOutcome} onValueChange={setEscrowOutcome}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="release_seller">
                                Libérer au vendeur
                              </SelectItem>
                              <SelectItem value="refund_buyer">
                                Rembourser l&apos;acheteur
                              </SelectItem>
                              <SelectItem value="keep_frozen">
                                Garder gelé (manuel)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Met à jour la commande + escrow_transactions.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDispute(null)}>
              Fermer
            </Button>
            {selectedDispute && selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
              <Button 
                onClick={() => handleUpdateDispute(selectedDispute)}
                disabled={processing || !newStatus || (
                  (newStatus === 'resolved' || newStatus === 'closed') && !resolution.trim()
                )}
              >
                {processing ? "Traitement..." : "Mettre a jour"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
