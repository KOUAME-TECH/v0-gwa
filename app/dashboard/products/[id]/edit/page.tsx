"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2, X, Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "", description: "", price: "", unit: "kg",
    stock_quantity: "", product_type: "agriculture", status: "active",
  })
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string; category_type: string }[]>([])
  const [categoryId, setCategoryId] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }

      const [{ data: product }, { data: cats }] = await Promise.all([
        supabase.from("products").select("id, name, price, unit, images, description, origin_country, origin_region, is_organic, is_fair_trade, product_type, seller_id, category_id, status, created_at, updated_at, stock_quantity").eq("id", productId).eq("seller_id", user.id).single(),
        supabase.from("categories").select("id, name, slug, category_type").eq("category_type", "agriculture").is("parent_id", null).order("name"),
      ])

      if (!product) { toast.error("Produit introuvable"); router.push("/dashboard/products"); return }

      setForm({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        unit: product.unit || "kg",
        stock_quantity: product.stock_quantity?.toString() || "",
        product_type: product.product_type || "agriculture",
        status: product.status || "active",
      })
      setExistingImages(product.images || [])
      setCategoryId(product.category_id || "")
      setCategories(cats || [])
      setLoading(false)
    }
    load()
  }, [productId, router, supabase])

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error("Nom et prix obligatoires"); return }
    setSaving(true)

    try {
      // Upload new images
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let allImages = [...existingImages]
      for (const img of newImages) {
        const ext = img.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from("products").upload(path, img.file)
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("products").getPublicUrl(path)
          allImages.push(publicUrl)
        }
      }

      const { error } = await supabase.from("products").update({
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        unit: form.unit,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        product_type: form.product_type,
        category_id: categoryId || null,
        images: allImages.length > 0 ? allImages : null,
        status: form.status,
        updated_at: new Date().toISOString(),
      }).eq("id", productId)

      if (error) throw error

      toast.success("Produit mis a jour !")
      router.push("/dashboard/products")
    } catch (err: any) {
      toast.error(err.message || "Erreur de sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Supprimer ce produit ? Il sera retiré de la vente.")) return
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Erreur de suppression")
      toast.success("Produit supprimé")
      router.push("/dashboard/products")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de suppression")
    }
  }

  const filteredCats = categories.filter(c => c.category_type === form.product_type)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-40">
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </button>
          <h1 className="text-lg font-semibold text-[#111827]">Modifier le produit</h1>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.price}
            className="bg-[#2F7D32] hover:bg-[#256025] text-white rounded-full px-5 h-9 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Images */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">Photos</label>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {existingImages.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#E5E7EB]">
                <Image src={url} alt="" fill className="object-cover" />
                <button onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {newImages.map((img, i) => (
              <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#E5E7EB]">
                <Image src={img.preview} alt="" fill className="object-cover" />
                <button onClick={() => { URL.revokeObjectURL(img.preview); setNewImages(prev => prev.filter((_, idx) => idx !== i)) }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {(existingImages.length + newImages.length) < 5 && (
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E5E7EB] flex flex-col items-center justify-center gap-1 shrink-0 cursor-pointer active:border-[#2F7D32]">
                <Camera className="h-5 w-5 text-[#9CA3AF]" />
                <span className="text-[10px] text-[#9CA3AF]">Ajouter</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setNewImages(prev => [...prev, { file: f, preview: URL.createObjectURL(f) }])
                  e.target.value = ""
                }} />
              </label>
            )}
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">Nom du produit *</label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="h-12 rounded-xl border-[#E5E7EB] bg-white" />
        </div>

        {/* Prix & Unite */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-[#111827] mb-2 block">Prix (FCFA) *</label>
            <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              className="h-12 rounded-xl border-[#E5E7EB] bg-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#111827] mb-2 block">Unite</label>
            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
              className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm">
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
          <Input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })}
            className="h-12 rounded-xl border-[#E5E7EB] bg-white" />
        </div>

        {/* Categorie */}
        {filteredCats.length > 0 && (
          <div>
            <label className="text-sm font-medium text-[#111827] mb-3 block">Categorie</label>
            <div className="flex flex-wrap gap-2">
              {filteredCats.slice(0, 12).map(cat => (
                <button key={cat.id} onClick={() => setCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    categoryId === cat.id ? "bg-[#111827] text-white" : "bg-white border border-[#E5E7EB] text-[#4B5563]"
                  }`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">Statut</label>
          <div className="flex gap-3">
            {[{ val: "active", label: "Actif", color: "bg-[#2F7D32]" }, { val: "paused", label: "En pause", color: "bg-[#F39A1F]" }, { val: "sold_out", label: "Epuise", color: "bg-red-500" }].map(s => (
              <button key={s.val} onClick={() => setForm({ ...form, status: s.val })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  form.status === s.val ? `${s.color} text-white` : "bg-white border border-[#E5E7EB] text-[#4B5563]"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">Description</label>
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Decrivez votre produit..." className="min-h-[100px] rounded-xl border-[#E5E7EB] bg-white resize-none" />
        </div>

        {/* Delete */}
        <button onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 active:bg-red-50">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm font-medium">Supprimer le produit</span>
        </button>
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] bg-white border-t border-[#E5E7EB] z-40">
        <Button onClick={handleSave} disabled={saving || !form.name || !form.price}
          className="w-full h-12 rounded-full bg-[#2F7D32] hover:bg-[#256025] text-white text-base font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  )
}
