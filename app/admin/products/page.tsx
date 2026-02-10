"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Package,
  RefreshCw,
  ExternalLink,
} from "lucide-react"

interface Product {
  id: string
  name: string
  description?: string
  price: number
  stock_quantity: number
  product_type: string
  status: string
  moderation_status: string
  moderation_notes?: string
  images?: string[]
  created_at: string
  seller: {
    id: string
    full_name: string
    avatar_url?: string
    is_verified: boolean
  }
  category?: {
    name: string
  }
}

function AdminProductsContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get("status") || "all")
  const [filterType, setFilterType] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [moderationDialogOpen, setModerationDialogOpen] = useState(false)
  const [moderationAction, setModerationAction] = useState<"approve" | "reject">("approve")
  const [moderationNotes, setModerationNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 20

  useEffect(() => {
    fetchProducts()
  }, [filterStatus, filterType, page])

  const fetchProducts = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("products")
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(id, full_name, avatar_url, is_verified),
        category:categories!products_category_id_fkey(name)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (filterStatus !== "all") {
      query = query.eq("moderation_status", filterStatus)
    }

    if (filterType !== "all") {
      query = query.eq("product_type", filterType)
    }

    const { data, count, error } = await query

    if (!error && data) {
      setProducts(data.map(p => ({
        ...p,
        seller: Array.isArray(p.seller) ? p.seller[0] : p.seller,
        category: Array.isArray(p.category) ? p.category[0] : p.category
      })) as Product[])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  const searchProducts = async () => {
    if (!searchQuery.trim()) {
      fetchProducts()
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(id, full_name, avatar_url, is_verified),
        category:categories!products_category_id_fkey(name)
      `)
      .ilike("name", `%${searchQuery}%`)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setProducts(data.map(p => ({
        ...p,
        seller: Array.isArray(p.seller) ? p.seller[0] : p.seller,
        category: Array.isArray(p.category) ? p.category[0] : p.category
      })) as Product[])
    }
    setLoading(false)
  }

  const handleModeration = async () => {
    if (!selectedProduct) return
    setActionLoading(true)

    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    const newStatus = moderationAction === "approve" ? "approved" : "rejected"

    const { error } = await supabase
      .from("products")
      .update({
        moderation_status: newStatus,
        moderation_notes: moderationNotes || null,
        moderated_by: adminUser?.id,
        moderated_at: new Date().toISOString(),
        status: moderationAction === "approve" ? "active" : "rejected",
      })
      .eq("id", selectedProduct.id)

    if (!error) {
      await supabase.from("admin_logs").insert({
        admin_id: adminUser?.id,
        action: `${moderationAction}_product`,
        entity_type: "product",
        entity_id: selectedProduct.id,
        new_data: { moderation_status: newStatus, moderation_notes: moderationNotes },
      })

      setProducts(products.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, moderation_status: newStatus, moderation_notes: moderationNotes }
          : p
      ))
      setModerationDialogOpen(false)
      setModerationNotes("")
      setSelectedProduct(null)
    }
    setActionLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getModerationBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "En attente", variant: "secondary" },
      approved: { label: "Approuvé", variant: "default" },
      rejected: { label: "Rejeté", variant: "destructive" },
    }
    const config = statusConfig[status] || { label: status, variant: "outline" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Produits</h1>
          <p className="text-muted-foreground">{totalCount} produits au total</p>
        </div>
        <Button variant="outline" onClick={fetchProducts} className="bg-transparent">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchProducts()}
                  className="pl-9"
                />
              </div>
              <Button onClick={searchProducts}>Rechercher</Button>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="rejected">Rejetés</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="artisanat">Artisanat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun produit trouvé</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Vendeur</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Modération</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded bg-muted overflow-hidden flex-shrink-0">
                              {product.images?.[0] ? (
                                <img 
                                  src={product.images[0] || "/placeholder.svg"} 
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.category?.name || product.product_type}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={product.seller?.avatar_url || "/placeholder.svg"} />
                              <AvatarFallback>{product.seller?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium truncate max-w-[120px]">
                                {product.seller?.full_name}
                              </p>
                              {product.seller?.is_verified && (
                                <Badge variant="outline" className="text-xs py-0 border-green-500 text-green-600">
                                  Vérifié
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(product.price)}</TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell>{getModerationBadge(product.moderation_status)}</TableCell>
                        <TableCell>{formatDate(product.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir le produit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Voir sur le site
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {product.moderation_status === "pending" && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedProduct(product)
                                      setModerationAction("approve")
                                      setModerationDialogOpen(true)
                                    }}
                                    className="text-green-600"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approuver
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedProduct(product)
                                      setModerationAction("reject")
                                      setModerationDialogOpen(true)
                                    }}
                                    className="text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Rejeter
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Affichage de {page * pageSize + 1} à {Math.min((page + 1) * pageSize, totalCount)} sur {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="bg-transparent"
                  >
                    Précédent
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={(page + 1) * pageSize >= totalCount}
                    className="bg-transparent"
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Moderation Dialog */}
      <Dialog open={moderationDialogOpen} onOpenChange={setModerationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {moderationAction === "approve" ? "Approuver" : "Rejeter"} le produit
            </DialogTitle>
            <DialogDescription>
              {moderationAction === "approve" 
                ? "Ce produit sera visible sur la marketplace."
                : "Ce produit ne sera pas publié sur la marketplace."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProduct && (
              <div className="flex gap-4 p-3 border rounded-lg">
                <div className="h-16 w-16 rounded bg-muted overflow-hidden flex-shrink-0">
                  {selectedProduct.images?.[0] ? (
                    <img 
                      src={selectedProduct.images[0] || "/placeholder.svg"} 
                      alt={selectedProduct.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Par {selectedProduct.seller?.full_name}
                  </p>
                  <p className="text-sm font-medium">{formatCurrency(selectedProduct.price)}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {moderationAction === "approve" ? "Notes (optionnel)" : "Raison du rejet"}
              </Label>
              <Textarea
                id="notes"
                placeholder={moderationAction === "approve" 
                  ? "Ajoutez des notes si nécessaire..."
                  : "Expliquez pourquoi ce produit est rejeté..."}
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerationDialogOpen(false)} className="bg-transparent">
              Annuler
            </Button>
            <Button 
              variant={moderationAction === "approve" ? "default" : "destructive"}
              onClick={handleModeration}
              disabled={actionLoading || (moderationAction === "reject" && !moderationNotes.trim())}
            >
              {actionLoading ? "En cours..." : moderationAction === "approve" ? "Approuver" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <AdminProductsContent />
    </Suspense>
  )
}
