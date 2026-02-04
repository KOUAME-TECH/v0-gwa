"use client"

import React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, X, Package, MessageSquare, ImagePlus, ChevronRight, Loader2, Camera } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type PublishType = "product" | "post" | null

type Category = {
  id: string
  name: string
  slug: string
  category_type: string
}

type ImageFile = {
  file: File
  preview: string
}

export default function PublierPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [publishType, setPublishType] = useState<PublishType>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<ImageFile[]>([])
  
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    unit: "kg",
    stock_quantity: "",
    category_id: "",
    product_type: "agriculture",
  })
  
  const [postContent, setPostContent] = useState("")

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      setIsLoading(false)
      
      // Charger les categories
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, category_type")
        .is("parent_id", null)
        .order("name")
      setCategories(data || [])
    }
    init()
  }, [supabase])

  // Cleanup des previews au unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, [images])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const maxImages = publishType === "post" ? 4 : 5
    const remaining = maxImages - images.length
    
    const newImages = Array.from(files).slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))

    setImages(prev => [...prev, ...newImages])
    
    // Reset l'input pour permettre de re-selectionner le meme fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadImages = async (bucket: string): Promise<string[]> => {
    if (!user || images.length === 0) return []
    
    const urls: string[] = []
    
    for (let i = 0; i < images.length; i++) {
      const { file } = images[i]
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error("Upload error:", error)
        throw new Error(`Erreur upload image ${i + 1}`)
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      urls.push(publicUrl)
      setUploadProgress(Math.round(((i + 1) / images.length) * 100))
    }

    return urls
  }

  const handleSubmitProduct = async () => {
    if (!user) return
    if (!productForm.name || !productForm.price || !productForm.category_id) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      let imageUrls: string[] = []
      
      if (images.length > 0) {
        imageUrls = await uploadImages('products')
      }

      const { error } = await supabase.from("products").insert({
        seller_id: user.id,
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        unit: productForm.unit,
        stock_quantity: parseInt(productForm.stock_quantity) || 0,
        category_id: productForm.category_id,
        product_type: productForm.product_type,
        images: imageUrls.length > 0 ? imageUrls : null,
        status: "active",
      })
      
      if (error) throw error
      
      toast.success("Produit publie avec succes!")
      router.push("/profil")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error(error.message || "Erreur lors de la publication")
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const handleSubmitPost = async () => {
    if (!user) return
    if (!postContent.trim() && images.length === 0) {
      toast.error("Ajoutez du texte ou une image")
      return
    }
    
    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      let mediaUrls: { url: string; type: string }[] = []
      
      if (images.length > 0) {
        const urls = await uploadImages('posts')
        mediaUrls = urls.map(url => ({ url, type: 'image' }))
      }

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: postContent.trim(),
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        visibility: "public",
        post_type: mediaUrls.length > 0 ? "media" : "standard",
      })
      
      if (error) throw error
      
      toast.success("Publication creee!")
      router.push("/")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error(error.message || "Erreur lors de la publication")
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const filteredCategories = categories.filter(
    (cat) => cat.category_type === productForm.product_type
  )

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  // Non connecte
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-[#2F7D32]/10 rounded-full flex items-center justify-center mb-6">
          <Camera className="h-10 w-10 text-[#2F7D32]" />
        </div>
        <h2 className="text-xl font-semibold text-[#111827] mb-2 text-center">Connectez-vous pour publier</h2>
        <p className="text-[#4B5563] text-center mb-6">Partagez vos produits et actualites avec la communaute GWA</p>
        <Link href="/auth/login?redirect=/publier">
          <Button className="bg-[#2F7D32] hover:bg-[#256025] text-white rounded-full px-8 h-12">
            Se connecter
          </Button>
        </Link>
      </div>
    )
  }

  // Input file cache
  const FileInput = (
    <input
      type="file"
      ref={fileInputRef}
      onChange={handleImageSelect}
      accept="image/jpeg,image/png,image/gif,image/webp"
      multiple
      className="hidden"
    />
  )

  // Selection du type
  if (!publishType) {
    return (
      <div className="min-h-screen bg-[#FFF6E5]">
        {FileInput}
        <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
          <div className="flex items-center h-14 px-4">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="h-5 w-5 text-[#111827]" />
            </button>
            <h1 className="text-lg font-semibold text-[#111827] ml-2">Nouvelle publication</h1>
          </div>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-[#4B5563] text-center mb-2">Que souhaitez-vous publier ?</p>
          
          <button
            onClick={() => setPublishType("post")}
            className="w-full p-5 rounded-2xl bg-white border border-[#E5E7EB] active:border-[#F39A1F] flex items-center gap-4 text-left transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-[#F39A1F]/10 flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-[#F39A1F]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#111827]">Publication</h3>
              <p className="text-sm text-[#4B5563]">Partagez une photo ou actualite</p>
            </div>
            <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
          </button>

          <button
            onClick={() => setPublishType("product")}
            className="w-full p-5 rounded-2xl bg-white border border-[#E5E7EB] active:border-[#2F7D32] flex items-center gap-4 text-left transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-[#2F7D32]/10 flex items-center justify-center">
              <Package className="h-7 w-7 text-[#2F7D32]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#111827]">Produit a vendre</h3>
              <p className="text-sm text-[#4B5563]">Mettez en vente un produit</p>
            </div>
            <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
          </button>
        </div>
      </div>
    )
  }

  // Formulaire POST
  if (publishType === "post") {
    return (
      <div className="min-h-screen bg-[#FFF6E5] pb-24">
        {FileInput}
        <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between h-14 px-4">
            <button onClick={() => { setPublishType(null); setImages([]); setPostContent("") }} className="p-2 -ml-2">
              <ArrowLeft className="h-5 w-5 text-[#111827]" />
            </button>
            <h1 className="text-lg font-semibold text-[#111827]">Nouvelle publication</h1>
            <Button
              onClick={handleSubmitPost}
              disabled={isSubmitting || (!postContent.trim() && images.length === 0)}
              className="bg-[#F39A1F] hover:bg-[#E08A10] text-white rounded-full px-5 h-9 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier"}
            </Button>
          </div>
        </header>

        <div className="p-4">
          <Textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="Quoi de neuf ? Partagez une actualite, une question ou un conseil..."
            className="min-h-[120px] border-0 bg-transparent text-[#111827] placeholder:text-[#9CA3AF] text-base resize-none focus-visible:ring-0 p-0"
            autoFocus
          />

          {/* Preview images */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-[#E5E7EB]">
                  <Image
                    src={img.preview || "/placeholder.svg"}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#F39A1F] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-[#4B5563] mt-1 text-center">Upload... {uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= 4}
            className="flex items-center gap-2 text-[#2F7D32] disabled:opacity-40"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-sm font-medium">Photo ({images.length}/4)</span>
          </button>
        </div>
      </div>
    )
  }

  // Formulaire PRODUIT
  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-28">
      {FileInput}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => { setPublishType(null); setImages([]); setProductForm({ name: "", description: "", price: "", unit: "kg", stock_quantity: "", category_id: "", product_type: "agriculture" }) }} className="p-2 -ml-2">
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </button>
          <h1 className="text-lg font-semibold text-[#111827]">Nouveau produit</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Images */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">Photos du produit</label>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img, index) => (
              <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#E5E7EB]">
                <Image src={img.preview || "/placeholder.svg"} alt="" fill className="object-cover" />
                <button 
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E5E7EB] flex flex-col items-center justify-center gap-1 flex-shrink-0 active:border-[#2F7D32]"
              >
                <Camera className="h-5 w-5 text-[#9CA3AF]" />
                <span className="text-[10px] text-[#9CA3AF]">Ajouter</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        {isSubmitting && uploadProgress > 0 && (
          <div>
            <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2F7D32] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-[#4B5563] mt-1 text-center">Upload... {uploadProgress}%</p>
          </div>
        )}

        {/* Type */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">Type de produit</label>
          <div className="flex gap-3">
            <button
              onClick={() => setProductForm({ ...productForm, product_type: "agriculture", category_id: "" })}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-medium transition-colors",
                productForm.product_type === "agriculture" 
                  ? "bg-[#2F7D32] text-white" 
                  : "bg-white border border-[#E5E7EB] text-[#4B5563]"
              )}
            >
              Agriculture
            </button>
            <button
              onClick={() => setProductForm({ ...productForm, product_type: "artisanat", category_id: "" })}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-medium transition-colors",
                productForm.product_type === "artisanat" 
                  ? "bg-[#F39A1F] text-white" 
                  : "bg-white border border-[#E5E7EB] text-[#4B5563]"
              )}
            >
              Artisanat
            </button>
          </div>
        </div>

        {/* Categorie */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">Categorie *</label>
          <div className="flex flex-wrap gap-2">
            {filteredCategories.slice(0, 12).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setProductForm({ ...productForm, category_id: cat.id })}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  productForm.category_id === cat.id
                    ? "bg-[#111827] text-white"
                    : "bg-white border border-[#E5E7EB] text-[#4B5563]"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">Nom du produit *</label>
          <Input
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            placeholder="Ex: Cacao bio premium"
            className="h-12 rounded-xl border-[#E5E7EB] bg-white"
          />
        </div>

        {/* Prix & Unite */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-[#111827] mb-2 block">Prix (FCFA) *</label>
            <Input
              type="number"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              placeholder="0"
              className="h-12 rounded-xl border-[#E5E7EB] bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#111827] mb-2 block">Unite</label>
            <select
              value={productForm.unit}
              onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
              className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm"
            >
              <option value="kg">Kilogramme</option>
              <option value="g">Gramme</option>
              <option value="L">Litre</option>
              <option value="piece">Piece</option>
              <option value="sac">Sac</option>
              <option value="lot">Lot</option>
            </select>
          </div>
        </div>

        {/* Stock */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">Quantite disponible</label>
          <Input
            type="number"
            value={productForm.stock_quantity}
            onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
            placeholder="Ex: 100"
            className="h-12 rounded-xl border-[#E5E7EB] bg-white"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">Description</label>
          <Textarea
            value={productForm.description}
            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            placeholder="Decrivez votre produit..."
            className="min-h-[100px] rounded-xl border-[#E5E7EB] bg-white resize-none"
          />
        </div>
      </div>

      {/* Fixed button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-[#E5E7EB]">
        <Button 
          onClick={handleSubmitProduct}
          disabled={isSubmitting || !productForm.name || !productForm.price || !productForm.category_id}
          className="w-full h-12 rounded-full bg-[#2F7D32] hover:bg-[#256025] text-white text-base font-semibold disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Publier le produit"}
        </Button>
      </div>
    </div>
  )
}
