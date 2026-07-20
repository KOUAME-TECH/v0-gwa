"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Camera, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

type Profile = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  phone: string | null
  city: string | null
  country: string | null
  address: string | null
}

const userTypes = [
  { value: "producteur", label: "Producteur agricole" },
  { value: "acheteur", label: "Acheteur" },
  { value: "cooperative", label: "Coopérative" },
]

const countries = [
  "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Ghana", 
  "Togo", "Bénin", "Niger", "Guinée", "Cameroun", "Nigeria",
  "Kenya", "Tanzanie", "Ouganda", "Rwanda", "Éthiopie", "Maroc",
  "Tunisie", "Algérie", "Afrique du Sud", "Autre"
]

export default function EditProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    bio: "",
    user_type: "",
    phone: "",
    city: "",
    country: "",
    address: "",
  })
  const [emailLinkMsg, setEmailLinkMsg] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) {
        setProfile({ ...profileData, email: user.email || "" })
        setFormData({
          full_name: profileData.full_name || "",
          email: profileData.linked_email || profileData.email || user.email || "",
          bio: profileData.bio || "",
          user_type: profileData.user_type || "",
          phone: profileData.phone || user.phone || "",
          city: profileData.city || "",
          country: profileData.country || "",
          address: profileData.address || "",
        })
      }

      setIsLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setIsUploading(true)

    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`
      const filePath = `${profile.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: publicUrl })
      toast.success("Photo mise à jour")
    } catch (error) {
      console.error("Erreur upload avatar:", error)
      toast.error("Erreur lors de la mise à jour de la photo")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setIsSaving(true)
    setEmailLinkMsg(null)

    try {
      // Téléphone obligatoire : l'email y est rattaché
      if (!formData.phone?.trim()) {
        toast.error("Le numéro de téléphone est obligatoire")
        setIsSaving(false)
        return
      }

      const updateData = {
        full_name: formData.full_name,
        bio: formData.bio || null,
        user_type: formData.user_type || null,
        phone: formData.phone || null,
        city: formData.city || null,
        country: formData.country || null,
        address: formData.address || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id)

      if (error) throw error

      // Lier l'email au numéro déjà enregistré
      if (formData.email?.trim()) {
        const res = await fetch("/api/auth/link-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            countryCode: "ci",
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || "Impossible de lier l'email")
          setIsSaving(false)
          return
        }
        setEmailLinkMsg(
          data.needs_email_confirmation
            ? "Email lié au téléphone. Vérifiez votre boîte mail si demandé."
            : "Email lié à votre numéro de téléphone.",
        )
      }

      toast.success("Profil mis à jour — email lié au téléphone")
      router.push("/profil")
    } catch (error) {
      console.error("Erreur mise à jour profil:", error)
      toast.error("Erreur lors de la mise à jour du profil")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between px-4 h-14">
          <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 active:opacity-60"
          >
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </button>
          <h1 className="font-semibold text-[#111827]">Modifier le profil</h1>
          <button 
            onClick={handleSubmit}
            disabled={isSaving}
            className="p-2 -mr-2 active:opacity-60 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#2F7D32]" />
            ) : (
              <Check className="h-5 w-5 text-[#2F7D32]" />
            )}
          </button>
        </div>
      </header>

      {/* Avatar Section */}
      <div className="bg-white px-4 py-6 mb-4">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-4 ring-[#FFF6E5]">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-[#2F7D32] text-white text-2xl font-medium">
                {profile.full_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#2F7D32] rounded-full flex items-center justify-center cursor-pointer shadow-lg">
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Camera className="h-4 w-4 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>
          <p className="text-sm text-[#4B5563] mt-2">Changer la photo</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-[#111827]">Informations personnelles</h2>
          
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-sm text-[#4B5563]">Nom complet</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="h-12 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50"
              placeholder="Votre nom complet"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm text-[#4B5563]">
              Téléphone (identifiant principal)
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="h-12 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50"
              placeholder="07 XX XX XX XX"
              required
            />
            <p className="text-xs text-[#6B7280]">
              Votre numéro est la clé du compte. L&apos;email ci-dessous y sera rattaché.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-[#4B5563]">
              Email (lié au téléphone)
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-12 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50"
              placeholder="votre@email.com"
            />
            <p className="text-xs text-[#6B7280]">
              Cet email est connecté au numéro enregistré — même compte GWA.
            </p>
            {emailLinkMsg && (
              <p className="text-xs text-[#2F7D32] font-medium">{emailLinkMsg}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user_type" className="text-sm text-[#4B5563]">Type de compte</Label>
            <Select
              value={formData.user_type}
              onValueChange={(value) => setFormData({ ...formData, user_type: value })}
            >
              <SelectTrigger className="h-12 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50">
                <SelectValue placeholder="Sélectionnez votre profil" />
              </SelectTrigger>
              <SelectContent>
                {userTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-sm text-[#4B5563]">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="min-h-[100px] rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50 resize-none"
              placeholder="Parlez-nous de vous et de votre activité..."
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-[#111827]">Localisation</h2>

          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm text-[#4B5563]">Pays</Label>
            <Select
              value={formData.country}
              onValueChange={(value) => setFormData({ ...formData, country: value })}
            >
              <SelectTrigger className="h-12 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50">
                <SelectValue placeholder="Sélectionnez votre pays" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm text-[#4B5563]">Ville</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="h-12 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50"
              placeholder="Votre ville"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm text-[#4B5563]">Adresse</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="min-h-[80px] rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50 resize-none"
              placeholder="Adresse complète (optionnel)"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={isSaving}
          className="w-full h-12 rounded-xl bg-[#2F7D32] hover:bg-[#256025] text-white font-medium"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer les modifications"
          )}
        </Button>
      </form>
    </div>
  )
}
