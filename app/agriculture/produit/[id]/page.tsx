"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Star, MapPin, Package, Users, CheckCircle2, Shield, Truck, 
  MessageCircle, Phone, ArrowLeft, Plus, Minus, ShoppingCart,
  Calendar, Award, FileText, Clock, ThumbsUp
} from 'lucide-react'
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [quantity, setQuantity] = useState(100)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  
  // Simuler les donnees du produit
  const product = {
    id: params.id,
    name: "Cacao Bio Premium Grade A",
    category: "Cacao",
    description: "Fèves de cacao de haute qualité, cultivées de manière biologique dans les plantations de Soubré. Parfait pour la fabrication de chocolat premium et les exportations.",
    seller: {
      name: "Coopérative SOCOOPENCO",
      location: "Soubré, Côte d'Ivoire",
      members: 450,
      rating: 4.8,
      reviews: 127,
      verified: true,
      since: "2018"
    },
    price: 2500,
    currency: "FCFA",
    unit: "kg",
    minOrder: 100,
    stock: 50000,
    certifications: ["Bio", "Fairtrade", "UTZ", "Rainforest Alliance"],
    specs: {
      grade: "Grade A",
      humidite: "7-8%",
      fermentation: "6-7 jours",
      sechage: "Naturel au soleil",
      origine: "Cote d'Ivoire - Region du Bas-Sassandra",
      recolte: "Novembre 2024"
    },
    images: ["/cacao-beans-ivory-coast.jpg"],
    rating: 4.8,
    reviews: [
      { user: "Chocolaterie Paris", rating: 5, comment: "Excellente qualite, livraison rapide", date: "15 Jan 2025" },
      { user: "Export Trading Co", rating: 5, comment: "Produit conforme, tres satisfait", date: "10 Jan 2025" },
      { user: "Artisan Chocolatier", rating: 4, comment: "Bon produit, emballage a ameliorer", date: "5 Jan 2025" }
    ]
  }

  const totalPrice = quantity * product.price

  const handleAddToCart = async () => {
    setIsAddingToCart(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push("/panier")
  }

  const handleContactSeller = () => {
    router.push(`/messages?seller=${product.seller.name}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/agriculture" className="hover:text-primary flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Retour aux produits
          </Link>
          <span>/</span>
          <span>{product.category}</span>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Product Images */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video relative overflow-hidden rounded-t-lg">
                  <img 
                    src={product.images[0] || "/placeholder.svg"} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    {product.certifications.slice(0, 2).map((cert, i) => (
                      <Badge key={i} className="bg-primary">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="seller">Vendeur</TabsTrigger>
                <TabsTrigger value="reviews">Avis ({product.reviews.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="description" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-muted-foreground leading-relaxed mb-6">
                      {product.description}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Shield className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">Qualite Garantie</div>
                          <div className="text-sm text-muted-foreground">Controle a chaque etape</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Truck className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">Livraison Securisee</div>
                          <div className="text-sm text-muted-foreground">Suivi en temps reel</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="specs" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {Object.entries(product.specs).map(([key, value]) => (
                        <div key={key} className="flex justify-between p-3 bg-muted rounded-lg">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Certifications</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.certifications.map((cert, i) => (
                          <Badge key={i} variant="outline" className="py-2 px-4">
                            <Award className="h-4 w-4 mr-2" />
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seller" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{product.seller.name}</h3>
                          {product.seller.verified && (
                            <Badge className="bg-primary">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verifie
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {product.seller.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Membre depuis {product.seller.since}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                          <Star className="h-5 w-5 fill-accent text-accent" />
                          {product.seller.rating}
                        </div>
                        <div className="text-sm text-muted-foreground">{product.seller.reviews} avis</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{product.seller.members}</div>
                        <div className="text-sm text-muted-foreground">Membres</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">98%</div>
                        <div className="text-sm text-muted-foreground">Satisfaction</div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button className="flex-1" onClick={handleContactSeller}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Envoyer un message
                      </Button>
                      <Button variant="outline">
                        <Phone className="h-4 w-4 mr-2" />
                        Appeler
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    {product.reviews.map((review, i) => (
                      <div key={i} className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">{review.user[0]}</span>
                            </div>
                            <span className="font-medium">{review.user}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[...Array(review.rating)].map((_, j) => (
                              <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                            ))}
                          </div>
                        </div>
                        <p className="text-muted-foreground">{review.comment}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {review.date}
                          </span>
                          <button className="flex items-center gap-1 hover:text-primary">
                            <ThumbsUp className="h-3 w-3" />
                            Utile
                          </button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Order Card */}
          <div className="space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < Math.floor(product.rating) ? "fill-accent text-accent" : "text-muted"}`} />
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">({product.seller.reviews} avis)</span>
                </div>
                <CardTitle className="text-2xl">{product.name}</CardTitle>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{product.seller.location}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Price */}
                <div>
                  <div className="text-4xl font-bold text-primary">
                    {product.price.toLocaleString()} {product.currency}
                    <span className="text-lg font-normal text-muted-foreground">/{product.unit}</span>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Package className="h-4 w-4" />
                    {product.stock.toLocaleString()} {product.unit} disponibles
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="space-y-2">
                  <Label>Quantite ({product.unit})</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setQuantity(Math.max(product.minOrder, quantity - 100))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(product.minOrder, parseInt(e.target.value) || 0))}
                      className="text-center"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setQuantity(quantity + 100)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Commande minimum: {product.minOrder} {product.unit}
                  </p>
                </div>

                {/* Total */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{totalPrice.toLocaleString()} {product.currency}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Frais de livraison</span>
                    <span className="text-primary">A calculer</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{totalPrice.toLocaleString()} {product.currency}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <Button className="w-full h-12" onClick={handleAddToCart} disabled={isAddingToCart}>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {isAddingToCart ? "Ajout en cours..." : "Ajouter au panier"}
                  </Button>
                  <Button variant="outline" className="w-full h-12 bg-transparent" onClick={handleContactSeller}>
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Contacter le vendeur
                  </Button>
                  <Link href={`/devis?product=${product.id}`}>
                    <Button variant="ghost" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Demander un devis personnalise
                    </Button>
                  </Link>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Paiement securise</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-primary" />
                    <span>Livraison suivie</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Qualité certifiée</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-primary" />
                    <span>Vendeur vérifié</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
