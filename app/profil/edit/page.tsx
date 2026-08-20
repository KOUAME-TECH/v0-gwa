"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Camera, Loader2, Check, MapPin, BadgeCheck, ShieldCheck } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { useListenMode } from "@/hooks/use-listen-mode"
import { useA11yPrefs } from "@/hooks/use-a11y-prefs"
import { useDataSaver } from "@/hooks/use-data-saver"
import {
  shouldPromptIdentityVerification,
  type KycStatus,
} from "@/lib/verification/badge"
import { useRealtimeLocation } from "@/hooks/use-realtime-location"
import { PlacesManager } from "@/components/location/places-manager"
import {
  getLinkCooldown,
  LINK_CHANGE_COOLDOWN_DAYS,
  linkCooldownMessage,
} from "@/lib/auth/link-cooldown"

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
  digest_enabled?: boolean | null
  is_verified?: boolean | null
  phone_verified?: boolean | null
  linked_email?: string | null
  email_linked_at?: string | null
  phone_linked_at?: string | null
  latitude?: number | null
  longitude?: number | null
}

const userTypes = [
  { value: "producteur", label: "Producteur agricole" },
  { value: "acheteur", label: "Acheteur" },
  { value: "cooperative", label: "Coopérative" },
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
    digest_enabled: true,
  })
  const [emailLinkMsg, setEmailLinkMsg] = useState<string | null>(null)
  const [kycStatus, setKycStatus] = useState<KycStatus>(null)
  const [locating, setLocating] = useState(false)
  const [linkingBusy, setLinkingBusy] = useState(false)
  const {
    location,
    status: geoStatus,
    error: geoError,
    request: requestLocation,
  } = useRealtimeLocation({ auto: true, maximumAge: 0 })
  const { enabled: listenMode, toggle: toggleListenMode, hydrated: listenHydrated } =
    useListenMode()
  const { largeText, setLargeText, quietHours, setQuietHours, reduceMotion, setReduceMotion } =
    useA11yPrefs()
  const {
    enabled: dataSaver,
    toggle: toggleDataSaver,
    hydrated: dataSaverHydrated,
  } = useDataSaver()

  // Auto-enregistrer la position dès qu'elle est captée (pas de saisie manuelle)
  useEffect(() => {
    if (!location || !profile?.id) return
    void fetch("/api/location/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: location.lat,
        lon: location.lon,
        city: location.city,
        country: location.country,
        region: location.region,
        address: location.address,
      }),
    }).then(async (res) => {
      if (!res.ok) return
      setFormData((prev) => ({
        ...prev,
        city: location.city || prev.city,
        country: location.country || prev.country,
        address: location.address || prev.address,
      }))
    })
  }, [location, profile?.id])

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/auth/login")
        return
      }

      const [{ data: profileData }, { data: kyc }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("verification_requests")
          .select("status")
          .eq("user_id", user.id)
          .eq("request_type", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

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
          digest_enabled: profileData.digest_enabled !== false,
        })
      }
      setKycStatus((kyc?.status as KycStatus) || null)

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

  const handleUseLocation = async () => {
    setLocating(true)
    const loc = await requestLocation()
    setLocating(false)
    if (!loc) {
      toast.error(geoError || "Autorisez la localisation dans le navigateur")
      return
    }
    setFormData((prev) => ({
      ...prev,
      city: loc.city || prev.city,
      country: loc.country || prev.country,
      address: loc.address || prev.address,
    }))
    const res = await fetch("/api/location/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: loc.lat,
        lon: loc.lon,
        city: loc.city,
        country: loc.country,
        region: loc.region,
        address: loc.address,
      }),
    })
    if (res.ok) toast.success("Position enregistrée")
    else toast.success("Position mise à jour")
  }

  const handleSecureLinkEmail = async () => {
    if (!formData.email?.trim()) {
      toast.error("Saisissez un email dans Informations personnelles")
      return
    }
    setLinkingBusy(true)
    setEmailLinkMsg(null)
    try {
      const res = await fetch("/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          countryCode: "ci",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Liaison impossible")
        setEmailLinkMsg(data.error || null)
        return
      }
      setEmailLinkMsg(
        data.needs_email_confirmation
          ? "Email lié de façon sécurisée. Vérifiez votre boîte mail si demandé."
          : "Email lié de façon sécurisée à votre compte.",
      )
      toast.success("Email lié")
      setProfile((p) =>
        p
          ? {
              ...p,
              linked_email: formData.email.trim(),
              email: formData.email.trim(),
              email_linked_at: new Date().toISOString(),
            }
          : p,
      )
    } finally {
      setLinkingBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setIsSaving(true)
    setEmailLinkMsg(null)

    try {
      // Téléphone déjà lié / affiché — pas d'écriture silencieuse ici
      if (!formData.phone?.trim() && !profile.phone) {
        toast.error("Le numéro de téléphone est obligatoire")
        setIsSaving(false)
        return
      }

      const updateData = {
        full_name: formData.full_name,
        bio: (formData.bio || "")
          .replace(/<\/?[a-z][^>]*>/gi, "")
          .replace(/[<>]/g, "")
          .trim()
          .slice(0, 2000) || null,
        city: formData.city || null,
        country: formData.country || null,
        address: formData.address || null,
        updated_at: new Date().toISOString(),
      }
      // user_type : verrouillé (trigger 049 + support)
      // phone : jamais écrit ici sans OTP (trigger 028 + flow sécurisé)
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id)

      if (error) throw error

      await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_enabled: formData.digest_enabled }),
      }).catch(() => null)

      toast.success("Profil mis à jour")
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

  const showKycInSettings = shouldPromptIdentityVerification({
    is_verified: profile.is_verified,
    kyc_status: kycStatus,
  })

  const emailCooldown = getLinkCooldown(profile.email_linked_at)
  const phoneCooldown = getLinkCooldown(profile.phone_linked_at)
  const hasRealEmail =
    !!(profile.linked_email || formData.email) &&
    !String(profile.linked_email || formData.email || "").includes("@users.gwa.local")
  const phoneLocked = profile.phone_verified === true && !phoneCooldown.allowed
  const emailLocked = hasRealEmail && profile.email_linked_at && !emailCooldown.allowed

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
              readOnly={!!phoneLocked}
              disabled={!!phoneLocked}
            />
            <p className="text-xs text-[#6B7280]">
              {phoneLocked
                ? linkCooldownMessage("téléphone", phoneCooldown)
                : profile.phone_verified
                  ? `Numéro vérifié. Changement possible après ${LINK_CHANGE_COOLDOWN_DAYS} jours.`
                  : "Confirmez ce numéro par SMS pour sécuriser le compte."}
            </p>
            {!profile.phone_verified || phoneCooldown.allowed ? (
              <Link href="/profil/lier">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 rounded-xl border-[#2F7D32] text-[#2F7D32]"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {profile.phone_verified ? "Modifier le téléphone (OTP)" : "Lier le téléphone (OTP)"}
                </Button>
              </Link>
            ) : null}
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
              readOnly={!!emailLocked}
              disabled={!!emailLocked}
            />
            <p className="text-xs text-[#6B7280]">
              {emailLocked
                ? linkCooldownMessage("email", emailCooldown)
                : "On vous envoie un lien de confirmation pour lier cet email."}
            </p>
            {emailLinkMsg && (
              <p className="text-xs text-[#2F7D32] font-medium">{emailLinkMsg}</p>
            )}
            {!emailLocked && (
              <Button
                type="button"
                variant="outline"
                disabled={linkingBusy || !formData.email.trim()}
                onClick={() => void handleSecureLinkEmail()}
                className="w-full h-10 rounded-xl border-[#2F7D32] text-[#2F7D32]"
              >
                {linkingBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {hasRealEmail ? "Modifier l'email (sécurisé)" : "Lier cet email"}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-[#4B5563]">Type de compte</Label>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FFF6E5]/50 px-3 py-3">
              <p className="text-sm font-medium text-[#111827]">
                {userTypes.find((t) => t.value === formData.user_type)?.label ||
                  formData.user_type ||
                  "Non défini"}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-1 leading-snug">
                Type de compte fixé. Changement via support GWA.
              </p>
            </div>
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

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-[#111827]">Écoute & Nouveautés</h2>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#374151]">Mode écoute (feed)</p>
            </div>
            <Switch
              checked={listenHydrated ? listenMode : false}
              onCheckedChange={() => toggleListenMode()}
              aria-label="Mode écoute"
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#374151]">Nouveautés quotidiennes</p>
            </div>
            <Switch
              checked={formData.digest_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, digest_enabled: checked })}
              aria-label="Activer les nouveautés audio"
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#374151]">Grand texte</p>
              <p className="text-xs text-[#6B7280]">Lecture plus confortable</p>
            </div>
            <Switch
              checked={largeText}
              onCheckedChange={setLargeText}
              aria-label="Grand texte"
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#374151]">Moins d’animations</p>
              <p className="text-xs text-[#6B7280]">Réduit le mouvement à l’écran</p>
            </div>
            <Switch
              checked={reduceMotion}
              onCheckedChange={setReduceMotion}
              aria-label="Moins d’animations"
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#374151]">Silence la nuit</p>
            </div>
            <Switch
              checked={quietHours}
              onCheckedChange={setQuietHours}
              aria-label="Silence la nuit (22h–6h)"
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#374151]">Économie de données</p>
            </div>
            <Switch
              checked={dataSaverHydrated ? dataSaver : false}
              onCheckedChange={() => toggleDataSaver()}
              aria-label="Économie de données"
            />
          </div>
        </div>

        {showKycInSettings && (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-[#111827]">Vérification d&apos;identité</h2>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Une pièce d&apos;identité et un selfie pour le badge vérifié. Vous
              pouvez utiliser GWA sans ça.
            </p>
            <Link href="/profil/verification">
              <Button
                type="button"
                className="w-full h-11 rounded-xl bg-[#2F7D32] hover:bg-[#256025]"
              >
                <BadgeCheck className="h-4 w-4 mr-2" />
                Vérifier mon identité
              </Button>
            </Link>
          </div>
        )}

        {!showKycInSettings && (kycStatus === "pending" || profile?.is_verified) && (
          <div className="bg-white rounded-2xl p-4 space-y-2">
            <h2 className="font-semibold text-[#111827]">Vérification d&apos;identité</h2>
            <p className="text-sm text-[#1F5C2E]">
              {profile?.is_verified || kycStatus === "approved"
                ? "Identité vérifiée. Badge actif."
                : "Demande en cours d'examen."}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-[#111827]">Localisation</h2>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                Détectée automatiquement. Pas besoin de saisir.
                {geoStatus === "denied"
                  ? " Autorisez la localisation pour continuer."
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-xl h-9 border-[#2F7D32] text-[#2F7D32]"
              disabled={locating}
              onClick={() => void handleUseLocation()}
            >
              {locating || geoStatus === "prompting" || geoStatus === "locating" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-1.5" />
                  Actualiser
                </>
              )}
            </Button>
          </div>

          {location ? (
            <div className="rounded-xl bg-[#FFF6E5]/80 border border-[#E5E7EB] px-3 py-3 space-y-1">
              <p className="text-sm font-medium text-[#111827] leading-snug">
                {location.address || location.label || formData.address || "Position GPS"}
              </p>
              {(location.city || formData.city) && (
                <p className="text-xs text-[#4B5563]">
                  {[location.city || formData.city, location.country || formData.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#6B7280]">
              {geoStatus === "denied"
                ? "Localisation refusée. Touchez Actualiser."
                : "Recherche de votre position…"}
            </p>
          )}

          {/* Champs cachés synchronisés pour la sauvegarde profil */}
          <input type="hidden" name="country" value={formData.country} readOnly />
          <input type="hidden" name="city" value={formData.city} readOnly />
          <input type="hidden" name="address" value={formData.address} readOnly />
        </div>

        <PlacesManager
          location={location}
          locating={locating || geoStatus === "locating" || geoStatus === "prompting"}
          onRequestLocation={async () => {
            setLocating(true)
            const loc = await requestLocation()
            setLocating(false)
            return loc
          }}
        />

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
