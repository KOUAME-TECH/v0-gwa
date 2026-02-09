"use client"

import React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Palette, Upload, Calendar, MapPin, Star, 
  CheckCircle2, ArrowRight, FileImage, Clock, Award, Loader2
} from 'lucide-react'
import { useRouter } from "next/navigation"

interface Category {
  id: string
  name: string
  slug: string
}

interface Artisan {
  id: string
  full_name: string
  avatar_url: string
  city: string
  country: string
  is_verified: boolean
  products_count?: number
  rating?: number
}

export default function CommissionsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [featuredArtisans, setFeaturedArtisans] = useState<Artisan[]>([])
  const [user, setUser] = useState<any>(null)
  
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    dimensions: "",
    colors: "",
    quantity: "1",
    deadline: "",
    budget: "",
    deliveryLocation: "",
    referenceImages: [] as string[],
    selectedArtisan: "",
    name: "",
    phone: "",
    email: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    // Load artisan categories
    const { data: catsData } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('category_type', 'artisanat')
      .order('name')

    if (catsData) {
      setCategories(catsData)
    }

    // Load featured artisans (verified artisans)
    const { data: artisansData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, city, country, is_verified')
      .eq('user_type', 'artisan')
      .eq('is_verified', true)
      .limit(4)

    if (artisansData) {
      // Get product count and average rating for each artisan
      const enrichedArtisans = await Promise.all(artisansData.map(async (artisan) => {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', artisan.id)
          .eq('status', 'active')

        return {
          ...artisan,
          products_count: count || 0,
          rating: 4.5 + Math.random() * 0.5 // Placeholder - should come from reviews
        }
      }))

      setFeaturedArtisans(enrichedArtisans)
    }

    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) {
      setStep(step + 1)
      return
    }
    
    setIsSubmitting(true)

    // Create custom order/commission request
    const { error } = await supabase
      .from('custom_orders')
      .insert({
        buyer_id: user?.id,
        artisan_id: formData.selectedArtisan === 'auto' ? null : formData.selectedArtisan,
        category_id: formData.category,
        description: formData.description,
        dimensions: formData.dimensions,
        colors: formData.colors,
        quantity: parseInt(formData.quantity),
        deadline: formData.deadline || null,
        budget: formData.budget ? parseInt(formData.budget) : null,
        delivery_address: formData.deliveryLocation,
        contact_name: formData.name,
        contact_phone: formData.phone,
        contact_email: formData.email || null,
        status: 'pending'
      })

    if (error) {
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    router.push("/dashboard/commandes?new=true")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container px-4 py-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <Badge className="mb-4 bg-accent/10 text-accent border-0">
            <Palette className="h-4 w-4 mr-2" />
            Commande Personnalisee
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Créez Votre Pièce Unique
          </h1>
          <p className="text-muted-foreground">
            Decrivez votre projet et nos artisans certifies le realiseront selon vos specifications exactes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-center gap-2">
            {[
              { num: 1, label: "Description" },
              { num: 2, label: "Artisan" },
              { num: 3, label: "Coordonnees" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {step > s.num ? <CheckCircle2 className="h-5 w-5" /> : s.num}
                  </div>
                  <span className="text-xs mt-1 text-muted-foreground">{s.label}</span>
                </div>
                {i < 2 && <div className={`w-16 h-1 mx-2 ${step > s.num ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-w-2xl mx-auto">
            {/* Step 1: Description du projet */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Decrivez votre projet</CardTitle>
                  <CardDescription>
                    Plus votre description est detaillee, meilleur sera le resultat
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Catégorie d{"'"}artisanat</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description detaillee</Label>
                    <Textarea
                      id="description"
                      placeholder="Decrivez precisement ce que vous souhaitez : style, motifs, usage prevu, inspiration..."
                      rows={5}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dimensions">Dimensions souhaitees</Label>
                      <Input
                        id="dimensions"
                        placeholder="Ex: 30cm x 40cm"
                        value={formData.dimensions}
                        onChange={(e) => setFormData({...formData, dimensions: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="colors">Couleurs preferees</Label>
                      <Input
                        id="colors"
                        placeholder="Ex: Marron, beige, naturel"
                        value={formData.colors}
                        onChange={(e) => setFormData({...formData, colors: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantite</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Date souhaitee</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="deadline"
                          type="date"
                          className="pl-10"
                          value={formData.deadline}
                          onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget (FCFA)</Label>
                      <Input
                        id="budget"
                        type="number"
                        placeholder="Ex: 50000"
                        value={formData.budget}
                        onChange={(e) => setFormData({...formData, budget: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Images de reference (optionnel)</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <FileImage className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Glissez vos images ici ou cliquez pour parcourir
                      </p>
                      <Button type="button" variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Ajouter des images
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={!formData.category || !formData.description}>
                    Continuer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Choix de l'artisan */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Choisissez un artisan</CardTitle>
                  <CardDescription>
                    Sélectionnez un artisan certifié ou laissez-nous vous en recommander un
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="font-medium">Recommandation automatique</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Laissez GWA vous mettre en relation avec l'artisan le plus adapte a votre projet
                    </p>
                    <Button 
                      type="button" 
                      variant={formData.selectedArtisan === "auto" ? "default" : "outline"}
                      className="mt-3"
                      onClick={() => setFormData({...formData, selectedArtisan: "auto"})}
                    >
                      {formData.selectedArtisan === "auto" ? "Option selectionnee" : "Choisir cette option"}
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Ou choisissez un artisan
                      </span>
                    </div>
                  </div>

                  {featuredArtisans.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Aucun artisan certifie disponible pour le moment.</p>
                      <p className="text-sm">Sélectionnez la recommandation automatique.</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {featuredArtisans.map((artisan) => (
                        <div
                          key={artisan.id}
                          onClick={() => setFormData({...formData, selectedArtisan: artisan.id})}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary ${
                            formData.selectedArtisan === artisan.id 
                              ? "border-primary bg-primary/5" 
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={artisan.avatar_url || ''} />
                              <AvatarFallback>
                                {artisan.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{artisan.full_name || 'Artisan'}</span>
                                {artisan.is_verified && (
                                  <Badge variant="outline" className="text-xs">
                                    <Award className="h-3 w-3 mr-1" />
                                    Certifie
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {artisan.city && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {artisan.city}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-accent text-accent" />
                                  {artisan.rating?.toFixed(1)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {artisan.products_count} produits
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={() => setStep(1)}>
                      Retour
                    </Button>
                    <Button type="submit" className="flex-1" disabled={!formData.selectedArtisan}>
                      Continuer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Coordonnees */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vos coordonnees</CardTitle>
                  <CardDescription>
                    Pour vous contacter et livrer votre commande
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      placeholder="Votre nom"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telephone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+225 XX XX XX XX"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (optionnel)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="votre@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryLocation">Adresse de livraison</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        id="deliveryLocation"
                        placeholder="Adresse complete pour la livraison"
                        className="pl-10"
                        value={formData.deliveryLocation}
                        onChange={(e) => setFormData({...formData, deliveryLocation: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Resume */}
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <h4 className="font-medium">Resume de votre commande</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Catégorie :</span>
                      <span>{categories.find(c => c.id === formData.category)?.name || '-'}</span>
                      <span className="text-muted-foreground">Quantite:</span>
                      <span>{formData.quantity} piece(s)</span>
                      <span className="text-muted-foreground">Budget:</span>
                      <span>{formData.budget ? `${parseInt(formData.budget).toLocaleString()} FCFA` : "A definir"}</span>
                      <span className="text-muted-foreground">Delai:</span>
                      <span>{formData.deadline || "A definir"}</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Que se passe-t-il ensuite ?</p>
                        <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
                          <li>L'artisan recoit votre demande et vous contacte sous 24h</li>
                          <li>Vous discutez des details et validez le devis</li>
                          <li>L'artisan realise votre piece et vous envoie des photos</li>
                          <li>Vous recevez votre creation unique !</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={() => setStep(2)}>
                      Retour
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isSubmitting || !formData.name || !formData.phone}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        "Envoyer ma demande"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </form>

        {/* Info Section */}
        <div className="max-w-2xl mx-auto mt-12">
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-1">Artisans Certifiés</h3>
              <p className="text-sm text-muted-foreground">
                Tous nos artisans sont vérifiés et reconnus pour leur savoir-faire
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-1">Qualite Garantie</h3>
              <p className="text-sm text-muted-foreground">
                Paiement securise et satisfaction garantie sur toutes les commandes
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-1">Suivi en Temps Reel</h3>
              <p className="text-sm text-muted-foreground">
                Suivez l'avancement de votre creation etape par etape
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
