"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { AUDIO_LANGS } from "@/lib/media/audio-langs"

const categories = [
  { value: "agriculture", label: "Produits Agricoles", subcategories: [
    { value: "cereales", label: "Cereales" },
    { value: "fruits", label: "Fruits" },
    { value: "legumes", label: "Legumes" },
    { value: "oleagineux", label: "Oleagineux" },
    { value: "cacao-cafe", label: "Cacao & Cafe" },
    { value: "epices", label: "Epices" },
  ]},
]

const units = [
  { value: "kg", label: "Kilogramme (kg)" },
  { value: "tonne", label: "Tonne (t)" },
  { value: "piece", label: "Piece" },
  { value: "lot", label: "Lot" },
  { value: "litre", label: "Litre (L)" },
  { value: "sac", label: "Sac" },
]

export default function NewProductPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    subcategory: "",
    price: "",
    unit: "kg",
    stock: "",
    minOrder: "1",
    origin: "",
    audioLang: "fr",
    certifications: [] as string[],
    imageUrl: "",
  })
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      setUser(user)
    }
    checkUser()
  }, [router])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Verifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setError("Veuillez selectionner une image (JPG, PNG, WebP)")
      return
    }

    // Verifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas depasser 5MB")
      return
    }

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { data, error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName)

      setFormData({ ...formData, imageUrl: publicUrl })
      setImagePreview(publicUrl)
    } catch (err: any) {
      setError("Erreur lors de l'upload: " + (err.message || "Erreur inconnue"))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Récupérer ou créer la catégorie
    let { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', formData.subcategory || formData.category)
      .single()

    if (!categoryData) {
      const { data: newCategory, error: catError } = await supabase
        .from('categories')
        .insert({
          name: formData.subcategory || formData.category,
          slug: (formData.subcategory || formData.category).toLowerCase().replace(/\s+/g, '-'),
          category_type: 'agriculture'
        })
        .select('id')
        .single()
      
      if (catError) {
        setError("Erreur lors de la création de la catégorie : " + catError.message)
        setIsLoading(false)
        return
      }
      categoryData = newCategory
    }

    // Creer le produit
    const { error: productError } = await supabase
      .from('products')
      .insert({
        seller_id: user.id,
        category_id: categoryData.id,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        unit: formData.unit,
        stock_quantity: parseInt(formData.stock),
        min_order_quantity: parseInt(formData.minOrder),
        origin_country: formData.origin,
        origin_region: formData.origin,
        ville: formData.origin,
        audio_lang: formData.audioLang,
        certifications: formData.certifications.length > 0 ? formData.certifications : null,
        images: formData.imageUrl ? [formData.imageUrl] : [],
        status: 'active',
        product_type: 'agriculture',
      })

    if (productError) {
      setError(productError.message)
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push("/dashboard/products")
    }, 2000)
  }

  const selectedCategory = categories.find(c => c.value === formData.category)

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-8">
        <div className="mb-6">
          <Link href="/dashboard/products" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour aux produits</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ajouter un nouveau produit</CardTitle>
            <CardDescription>
              Remplissez les informations de votre produit pour le mettre en vente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 border-primary">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription>Produit ajoute avec succes ! Redirection...</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du produit *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Cacao premium de Cote d'Ivoire"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Decrivez votre produit en detail..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value, subcategory: ""})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sous-catégorie</Label>
                  <Select 
                    value={formData.subcategory} 
                    onValueChange={(value) => setFormData({...formData, subcategory: value})}
                    disabled={!selectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategory?.subcategories.map((sub) => (
                        <SelectItem key={sub.value} value={sub.value}>
                          {sub.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Prix (FCFA) *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unite</Label>
                  <Select value={formData.unit} onValueChange={(value) => setFormData({...formData, unit: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">Stock disponible *</Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minOrder">Commande minimum</Label>
                  <Input
                    id="minOrder"
                    type="number"
                    placeholder="1"
                    value={formData.minOrder}
                    onChange={(e) => setFormData({...formData, minOrder: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="origin">Origine / Region</Label>
                  <Input
                    id="origin"
                    placeholder="Ex: Abidjan, Cote d'Ivoire"
                    value={formData.origin}
                    onChange={(e) => setFormData({...formData, origin: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audioLang">Langue de la voix (voix communautaire)</Label>
                  <Select
                    value={formData.audioLang}
                    onValueChange={(value) => setFormData({ ...formData, audioLang: value })}
                  >
                    <SelectTrigger id="audioLang">
                      <SelectValue placeholder="Langue" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIO_LANGS.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pour un enregistrement vocal futur ou la synthèse adaptée à votre communauté.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Photo du produit</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  {imagePreview ? (
                    <div className="space-y-4">
                      <img 
                        src={imagePreview || "/placeholder.svg"} 
                        alt="Preview" 
                        className="mx-auto max-h-48 rounded-lg object-cover"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className="bg-transparent"
                        onClick={() => {
                          setImagePreview(null)
                          setFormData({...formData, imageUrl: ""})
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      <div className="space-y-2">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {uploading ? "Upload en cours..." : "Cliquez pour ajouter une photo"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG ou WebP - Max 5MB
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={() => router.back()}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Création en cours..." : "Créer le produit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
