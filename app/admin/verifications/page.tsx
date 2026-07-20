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
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, Eye, Search,
  FileText, User, Building2, Download, ExternalLink, RefreshCw
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface VerificationRequest {
  id: string
  user_id: string
  cooperative_id: string | null
  request_type: 'profile' | 'cooperative' | 'certification'
  documents: {
    type: string
    url: string
    name: string
  }[]
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  profiles?: {
    full_name: string
    email: string
    user_type: string
    avatar_url: string | null
    city: string
    country: string
  }
  cooperatives?: {
    name: string
    registration_number: string
  }
}

export default function AdminVerificationsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  
  const supabase = createClient()

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    
    const { data } = await supabase
      .from('verification_requests')
      .select(`
        *,
        profiles:user_id (full_name, email, user_type, avatar_url, city, country),
        cooperatives:cooperative_id (name, registration_number)
      `)
      .order('created_at', { ascending: false })

    if (data) {
      setRequests(data as VerificationRequest[])
    }
    setLoading(false)
  }

  async function handleApprove(request: VerificationRequest) {
    setProcessing(true)
    await fetch(`/api/admin/verifications/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    })

    setSelectedRequest(null)
    await loadRequests()
    setProcessing(false)
  }

  async function handleReject(request: VerificationRequest) {
    if (!rejectionReason.trim()) return

    setProcessing(true)
    await fetch(`/api/admin/verifications/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", notes: rejectionReason }),
    })

    setSelectedRequest(null)
    setRejectionReason("")
    await loadRequests()
    setProcessing(false)
  }

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'profile': return 'Verification de profil'
      case 'cooperative': return 'Verification cooperative'
      case 'certification': return 'Certification produit'
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">En attente</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-700">Approuve</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Refuse</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const filteredRequests = requests.filter(req => {
    const searchLower = searchQuery.toLowerCase()
    return (
      req.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      req.profiles?.email?.toLowerCase().includes(searchLower) ||
      req.cooperatives?.name?.toLowerCase().includes(searchLower)
    )
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

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
          <h1 className="text-2xl md:text-3xl font-bold">Verifications</h1>
          <p className="text-muted-foreground">Gerer les demandes de verification des utilisateurs</p>
        </div>
        <Button variant="outline" onClick={loadRequests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{requests.length}</p>
              <p className="text-sm text-muted-foreground">Total demandes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
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
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approuvees</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground">Refusees</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">En attente ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Approuvees ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Refusees ({rejectedCount})</TabsTrigger>
          <TabsTrigger value="all">Toutes ({requests.length})</TabsTrigger>
        </TabsList>

        {['pending', 'approved', 'rejected', 'all'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {filteredRequests.filter(r => tab === 'all' || r.status === tab).length === 0 ? (
              <Card className="p-12 text-center">
                <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune demande</h3>
                <p className="text-muted-foreground">
                  Les demandes de vérification apparaîtront ici
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredRequests
                  .filter(r => tab === 'all' || r.status === tab)
                  .map(request => (
                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={request.profiles?.avatar_url || ""} />
                            <AvatarFallback>
                              {request.profiles?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold truncate">
                                {request.profiles?.full_name || "Utilisateur"}
                              </p>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {request.profiles?.email}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {getRequestTypeLabel(request.request_type)}
                              </span>
                              <span>
                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: fr })}
                              </span>
                              {request.documents && (
                                <span>{request.documents.length} document(s)</span>
                              )}
                            </div>
                          </div>

                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
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
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Examiner la demande de verification</DialogTitle>
            <DialogDescription>
              Verifiez les informations et documents fournis
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* User Info */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedRequest.profiles?.avatar_url || ""} />
                    <AvatarFallback className="text-xl">
                      {selectedRequest.profiles?.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xl font-semibold">{selectedRequest.profiles?.full_name}</p>
                    <p className="text-muted-foreground">{selectedRequest.profiles?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{selectedRequest.profiles?.user_type}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {selectedRequest.profiles?.city}, {selectedRequest.profiles?.country}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Request Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Type de demande</p>
                    <p className="font-medium">{getRequestTypeLabel(selectedRequest.request_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de soumission</p>
                    <p>{new Date(selectedRequest.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {selectedRequest.cooperatives && (
                    <div>
                      <p className="text-sm text-muted-foreground">Coopérative</p>
                      <p className="font-medium">{selectedRequest.cooperatives.name}</p>
                      <p className="text-sm text-muted-foreground">
                        N° {selectedRequest.cooperatives.registration_number}
                      </p>
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div>
                  <h4 className="font-semibold mb-3">Documents fournis</h4>
                  {selectedRequest.documents && selectedRequest.documents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRequest.documents.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.name || `Document ${index + 1}`}</p>
                              <p className="text-sm text-muted-foreground">{doc.type}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4 mr-1" />
                                Voir
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.url} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Aucun document fourni</p>
                  )}
                </div>

                {/* Previous Notes */}
                {selectedRequest.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Notes precedentes</h4>
                    <p className="p-3 bg-muted rounded-lg">{selectedRequest.notes}</p>
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedRequest.status === 'pending' && (
                  <div>
                    <Label>Raison du refus (si applicable)</Label>
                    <Textarea
                      placeholder="Expliquez pourquoi la demande est refusee..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedRequest(null)}
                >
                  Fermer
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleReject(selectedRequest)}
                  disabled={processing || !rejectionReason.trim()}
                >
                  {processing ? "Traitement..." : "Refuser"}
                </Button>
                <Button 
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processing}
                >
                  {processing ? "Traitement..." : "Approuver"}
                </Button>
              </>
            )}
            {selectedRequest?.status !== 'pending' && (
              <Button onClick={() => setSelectedRequest(null)}>
                Fermer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
