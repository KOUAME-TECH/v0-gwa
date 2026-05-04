"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, Package } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  description: string
  price: number
  unit: string
  stock_quantity: number
  images: string[]
  status: string
  created_at: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchProducts = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, unit, images, description, origin_country, origin_region, is_organic, is_fair_trade, is_bulk_available, min_bulk_quantity, product_type, seller_id, category_id, status, likes_count, comments_count, shares_count, created_at, updated_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

      if (!error && data) {
        setProducts(data)
      }
      setIsLoading(false)
    }

    fetchProducts()
  }, [])

  const handleDelete = async (productId: string) => {
    if (!confirm("Etes-vous sur de vouloir supprimer ce produit ?")) return

    const supabase = createClient()
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (!error) {
      setProducts(products.filter(p => p.id !== productId))
    }
  }

  const toggleActive = async (productId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const supabase = createClient()
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', productId)

    if (!error) {
      setProducts(products.map(p => 
        p.id === productId ? { ...p, status: newStatus } : p
      ))
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mes Produits</h1>
            <p className="text-muted-foreground">Gérez vos produits en vente sur GWA</p>
          </div>
          <Button asChild>
            <Link href="/publier">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un produit
            </Link>
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun produit</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery 
                  ? "Aucun produit ne correspond a votre recherche" 
                  : "Vous n'avez pas encore ajoute de produit"}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link href="/publier">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter votre premier produit
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="aspect-video relative bg-muted">
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0] || "/placeholder.svg"}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge 
                    className={`absolute top-2 right-2 ${product.status === 'active' ? "bg-primary" : "bg-muted-foreground"}`}
                  >
                    {product.status === 'active' ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {product.description || "Pas de description"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/products/${product.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(product.id, product.status)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {product.status === 'active' ? "Desactiver" : "Activer"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-primary">
                      {product.price.toLocaleString()} FCFA/{product.unit}
                    </span>
                    <span className="text-muted-foreground">
                      Stock: {product.stock_quantity} {product.unit}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
