"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const TYPES = [
  { value: "agriculture", label: "Agriculture" },
  { value: "artisanat", label: "Artisanat" },
  { value: "commerce", label: "Commerce" },
  { value: "elevage", label: "Elevage" },
  { value: "peche", label: "Peche" },
  { value: "transformation", label: "Transformation" },
]

export default function CreateCooperativePage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", description: "", cooperative_type: "agriculture",
    country: "Cote d'Ivoire", city: "", address: "",
    phone: "", email: "", registration_number: "",
    founded_year: new Date().getFullYear().toString(),
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.city) { toast.error("Nom et ville sont obligatoires"); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }

      let logoUrl: string | null = null
      if (logo) {
        const ext = logo.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from("cooperatives").upload(path, logo, { upsert: false })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("cooperatives").getPublicUrl(path)
          logoUrl = publicUrl
        }
      }

      const { error } = await supabase.from("cooperatives").insert({
        name: form.name,
        description: form.description || null,
        cooperative_type: form.cooperative_type,
        country: form.country,
        city: form.city,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        registration_number: form.registration_number || null,
        founded_year: parseInt(form.founded_year) || null,
        logo_url: logoUrl,
        created_by: user.id,
        is_verified: false,
        member_count: 1,
      })

      if (error) throw error

      // Add creator as member
      const { data: coop } = await supabase.from("cooperatives").select("id").eq("name", form.name).eq("created_by", user.id).single()
      if (coop) {
        await supabase.from("cooperative_members").insert({ cooperative_id: coop.id, user_id: user.id, role: "admin" })
      }

      toast.success("Cooperative creee avec succes !")
      router.push("/cooperatives")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Erreur lors de la creation")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => router.back()} className="p-2 -ml-2"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-semibold ml-2">Creer une cooperative</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-28">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          {logoPreview ? (
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-muted">
              <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setLogo(null); setLogoPreview(null) }} className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full text-white flex items-center justify-center text-xs">X</button>
            </div>
          ) : (
            <label className="w-24 h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Logo</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setLogo(f); setLogoPreview(URL.createObjectURL(f)) }
              }} />
            </label>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Nom de la cooperative *</label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Cooperative Agricole de Bouake" className="h-12 rounded-xl" />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => set("cooperative_type", t.value)}
                className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  form.cooperative_type === t.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Pays</label>
            <Input value={form.country} onChange={e => set("country", e.target.value)} className="h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Ville *</label>
            <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Abidjan" className="h-12 rounded-xl" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Adresse</label>
          <Input value={form.address} onChange={e => set("address", e.target.value)} className="h-12 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Telephone</label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} type="tel" className="h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input value={form.email} onChange={e => set("email", e.target.value)} type="email" className="h-12 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">N registre</label>
            <Input value={form.registration_number} onChange={e => set("registration_number", e.target.value)} className="h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Annee de creation</label>
            <Input value={form.founded_year} onChange={e => set("founded_year", e.target.value)} type="number" className="h-12 rounded-xl" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Decrivez la cooperative..." className="min-h-[100px] rounded-xl resize-none" />
        </div>

        <div className="fixed bottom-[76px] left-0 right-0 p-4 bg-background border-t z-40">
          <Button type="submit" disabled={saving || !form.name || !form.city} className="w-full h-12 rounded-full text-base font-semibold">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Creer la cooperative"}
          </Button>
        </div>
      </form>
    </div>
  )
}
