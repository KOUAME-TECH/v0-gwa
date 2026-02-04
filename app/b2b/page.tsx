"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog"
import { 
  FileText, Plus, Clock, CheckCircle2, XCircle, Send, 
  Building2, MapPin, Calendar, Package, DollarSign, Eye,
  MessageSquare, TrendingUp
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface RFQ {
  id: string
  buyer_id: string
  title: string
  description: string
  category: string
  quantity: number
  unit: string
  budget_min: number | null
  budget_max: number | null
  delivery_location: string
  delivery_deadline: string
  status: string
  responses_count: number
  created_at: string
  profiles?: {
    full_name: string
    company_name: string | null
    city: string
  }
}

interface RFQResponse {
  id: string
  rfq_id: string
  seller_id: string
  proposed_price: number
  delivery_time_days: number
  message: string
  status: string
  created_at: string
  profiles?: {
    full_name: string
    company_name: string | null
  }
}

export default function B2BPage() {
  const router = useRouter()
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [myRfqs, setMyRfqs] = useState<RFQ[]>([])
  const [myResponses, setMyResponses] = useState<RFQResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newRfq, setNewRfq] = useState({
    title: "",
    description: "",
    category: "",
    quantity: "",
    unit: "kg",
    budget_min: "",
    budget_max: "",
    delivery_location: "",
    delivery_deadline: ""
  })
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setUserProfile(profile)

      // My RFQs
      const { data: myRfqsData } = await supabase
        .from('rfq_requests')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })

      if (myRfqsData) setMyRfqs(myRfqsData)

      // My Responses
      const { data: responsesData } = await supabase
        .from('rfq_responses')
        .select(`
          *,
          rfq_requests (title, status)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })

      if (responsesData) setMyResponses(responsesData)
    }

    // All open RFQs
    const { data: rfqsData } = await supabase
      .from('rfq_requests')
      .select(`
        *,
        profiles:buyer_id (full_name, company_name, city)
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (rfqsData) setRfqs(rfqsData)

    setLoading(false)
  }

  const handleCreateRfq = async () => {
    if (!user) return

    setCreating(true)

    const { data, error } = await supabase
      .from('rfq_requests')
      .insert({
        buyer_id: user.id,
        title: newRfq.title,
        description: newRfq.description,
        category: newRfq.category,
        quantity: parseFloat(newRfq.quantity),
        unit: newRfq.unit,
        budget_min: newRfq.budget_min ? parseFloat(newRfq.budget_min) : null,
        budget_max: newRfq.budget_max ? parseFloat(newRfq.budget_max) : null,
        delivery_location: newRfq.delivery_location,
        delivery_deadline: newRfq.delivery_deadline,
        status: 'open'
      })
      .select()
      .single()

    if (data) {
      setMyRfqs([data, ...myRfqs])
      setShowCreateDialog(false)
      setNewRfq({
        title: "",
        description: "",
        category: "",
        quantity: "",
        unit: "kg",
        budget_min: "",
        budget_max: "",
        delivery_location: "",
        delivery_deadline: ""
      })
    }

    setCreating(false)
  }

  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-700",
    awarded: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700"
  }

  const statusLabels: Record<string, string> = {
    open: "Ouvert",
    closed: "Ferme",
    awarded: "Attribue",
    cancelled: "Annule"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Espace B2B</h1>
            <p className="text-muted-foreground">
              Demandes de devis et opportunites commerciales en gros
            </p>
          </div>
          {user && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="mt-4 md:mt-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle demande de devis
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Creer une demande de devis</DialogTitle>
                  <DialogDescription>
                    Decrivez votre besoin pour recevoir des propositions de fournisseurs
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Titre de la demande</Label>
                    <Input
                      placeholder="Ex: Recherche 500kg de cacao bio"
                      value={newRfq.title}
                      onChange={(e) => setNewRfq({...newRfq, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description detaillee</Label>
                    <Textarea
                      placeholder="Decrivez vos besoins en detail..."
                      value={newRfq.description}
                      onChange={(e) => setNewRfq({...newRfq, description: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categorie</Label>
                      <Select value={newRfq.category} onValueChange={(v) => setNewRfq({...newRfq, category: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionnez" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cereales">Cereales</SelectItem>
                          <SelectItem value="fruits">Fruits</SelectItem>
                          <SelectItem value="legumes">Legumes</SelectItem>
                          <SelectItem value="oleagineux">Oleagineux</SelectItem>
                          <SelectItem value="cacao-cafe">Cacao & Cafe</SelectItem>
                          <SelectItem value="artisanat">Artisanat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantite souhaitee</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="500"
                          value={newRfq.quantity}
                          onChange={(e) => setNewRfq({...newRfq, quantity: e.target.value})}
                        />
                        <Select value={newRfq.unit} onValueChange={(v) => setNewRfq({...newRfq, unit: v})}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="tonnes">tonnes</SelectItem>
                            <SelectItem value="unites">unites</SelectItem>
                            <SelectItem value="cartons">cartons</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Budget minimum (FCFA)</Label>
                      <Input
                        type="number"
                        placeholder="100000"
                        value={newRfq.budget_min}
                        onChange={(e) => setNewRfq({...newRfq, budget_min: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Budget maximum (FCFA)</Label>
                      <Input
                        type="number"
                        placeholder="500000"
                        value={newRfq.budget_max}
                        onChange={(e) => setNewRfq({...newRfq, budget_max: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Lieu de livraison</Label>
                      <Input
                        placeholder="Abidjan, Cocody"
                        value={newRfq.delivery_location}
                        onChange={(e) => setNewRfq({...newRfq, delivery_location: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date limite de livraison</Label>
                      <Input
                        type="date"
                        value={newRfq.delivery_deadline}
                        onChange={(e) => setNewRfq({...newRfq, delivery_deadline: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateRfq} disabled={creating || !newRfq.title}>
                    {creating ? "Creation..." : "Publier la demande"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rfqs.length}</p>
                <p className="text-xs text-muted-foreground">Demandes ouvertes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myRfqs.length}</p>
                <p className="text-xs text-muted-foreground">Mes demandes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{myResponses.length}</p>
                <p className="text-xs text-muted-foreground">Mes reponses</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {rfqs.reduce((acc, r) => acc + (r.budget_max || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Volume total FCFA</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="marketplace">
          <TabsList>
            <TabsTrigger value="marketplace">Marketplace ({rfqs.length})</TabsTrigger>
            <TabsTrigger value="my-rfqs">Mes demandes ({myRfqs.length})</TabsTrigger>
            <TabsTrigger value="my-responses">Mes reponses ({myResponses.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="mt-6">
            {rfqs.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune demande ouverte</h3>
                <p className="text-muted-foreground">
                  Les demandes de devis apparaitront ici
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {rfqs.map(rfq => (
                  <RFQCard key={rfq.id} rfq={rfq} showBuyer />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-rfqs" className="mt-6">
            {myRfqs.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune demande creee</h3>
                <p className="text-muted-foreground mb-4">
                  Creez votre premiere demande de devis
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer une demande
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {myRfqs.map(rfq => (
                  <RFQCard key={rfq.id} rfq={rfq} showResponses />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-responses" className="mt-6">
            {myResponses.length === 0 ? (
              <Card className="p-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune reponse envoyee</h3>
                <p className="text-muted-foreground">
                  Repondez aux demandes de devis pour voir vos propositions ici
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {myResponses.map(response => (
                  <Card key={response.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{(response as any).rfq_requests?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Prix propose: {response.proposed_price.toLocaleString()} FCFA
                          </p>
                        </div>
                        <Badge className={statusColors[response.status]}>
                          {statusLabels[response.status] || response.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function RFQCard({ rfq, showBuyer, showResponses }: { 
  rfq: RFQ
  showBuyer?: boolean
  showResponses?: boolean
}) {
  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-700",
    awarded: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700"
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{rfq.title}</CardTitle>
            {showBuyer && rfq.profiles && (
              <CardDescription className="flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {rfq.profiles.company_name || rfq.profiles.full_name}
                <span className="mx-1">•</span>
                <MapPin className="h-3 w-3" />
                {rfq.profiles.city}
              </CardDescription>
            )}
          </div>
          <Badge className={statusColors[rfq.status]}>
            {rfq.status === 'open' ? 'Ouvert' : rfq.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {rfq.description}
        </p>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{rfq.quantity} {rfq.unit}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>
              {rfq.budget_min && rfq.budget_max 
                ? `${rfq.budget_min.toLocaleString()} - ${rfq.budget_max.toLocaleString()} FCFA`
                : 'Budget flexible'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{rfq.delivery_location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(rfq.delivery_deadline).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2 justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatDistanceToNow(new Date(rfq.created_at), { addSuffix: true, locale: fr })}
          {showResponses && (
            <>
              <span className="mx-1">•</span>
              <MessageSquare className="h-4 w-4" />
              {rfq.responses_count} reponses
            </>
          )}
        </div>
        <Link href={`/b2b/${rfq.id}`}>
          <Button size="sm">
            <Eye className="h-4 w-4 mr-1" />
            Voir
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
