"use client"

import React, { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Sprout,
  ShoppingCart,
  Users,
  Check,
  Phone,
  Mail,
  MapPin,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { mapAuthErrorMessage } from "@/lib/auth/auth-errors"
import { PhoneInput } from "@/components/auth/phone-input"
import { OtpInput, OtpCountdown } from "@/components/auth/otp-input"
import { maskPhone } from "@/lib/auth/phone"
import {
  computeProfileCompletion,
  USER_TYPE_MAP,
} from "@/lib/auth/post-auth"
import { cn } from "@/lib/utils"
import { HibpPasswordBanner } from "@/components/auth/hibp-password-banner"
import { useRealtimeLocation } from "@/hooks/use-realtime-location"
import { LocationMapCard } from "@/components/location/location-map-card"

const userTypes = [
  { value: "farmer", label: "Producteur", icon: Sprout },
  { value: "buyer", label: "Acheteur", icon: ShoppingCart },
  { value: "cooperative", label: "Cooperative", icon: Users },
]

const countries = [
  { value: "ci", label: "Côte d'Ivoire" },
  { value: "sn", label: "Sénégal" },
  { value: "cm", label: "Cameroun" },
  { value: "ml", label: "Mali" },
  { value: "bf", label: "Burkina Faso" },
  { value: "gh", label: "Ghana" },
  { value: "bj", label: "Bénin" },
  { value: "tg", label: "Togo" },
  { value: "gn", label: "Guinée" },
  { value: "ne", label: "Niger" },
  { value: "ng", label: "Nigeria" },
  { value: "ma", label: "Maroc" },
]

function countryNameToCode(name: string | null | undefined): string {
  if (!name) return ""
  const n = name.toLowerCase()
  const hit = countries.find(
    (c) =>
      c.label.toLowerCase() === n ||
      n.includes(c.label.toLowerCase()) ||
      c.label.toLowerCase().includes(n),
  )
  if (hit) return hit.value
  if (n.includes("ivoire") || n.includes("ivory")) return "ci"
  return ""
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedType = searchParams.get("type")
  const resumeOnboarding = searchParams.get("resume") === "onboarding"

  const [step, setStep] = useState(1)
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone")
  const [phoneOtpStep, setPhoneOtpStep] = useState<"input" | "otp" | "verified">("input")
  const [countryCode, setCountryCode] = useState("ci")
  const [phone, setPhone] = useState("")
  const [maskedPhone, setMaskedPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [otpExpiresAt, setOtpExpiresAt] = useState(0)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [existingAccountHint, setExistingAccountHint] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    location: gpsLocation,
    status: geoStatus,
    request: requestGps,
  } = useRealtimeLocation({ auto: false, maximumAge: 0 })

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    userType: preselectedType || "",
    country: "",
    city: "",
    address: "",
    lat: null as number | null,
    lon: null as number | null,
    acceptTerms: false,
    linkedEmail: "",
    phone: "",
  })

  useEffect(() => {
    if (preselectedType && userTypes.find((t) => t.value === preselectedType)) {
      setFormData((prev) => ({ ...prev, userType: preselectedType }))
    }
  }, [preselectedType])

  useEffect(() => {
    if (!resumeOnboarding) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setPhoneVerified(true)
        setAuthMethod("phone")
        setStep(2)
        if (user.phone) setPhone(user.phone.replace(/^\+225/, "0"))
      }
    })
  }, [resumeOnboarding])

  const handleSendOtp = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode, intent: "signup" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Envoi impossible")
        setIsLoading(false)
        return
      }
      setMaskedPhone(data.masked_phone || maskPhone(data.phone))
      setOtpExpiresAt(Date.now() + (data.expires_in || 600) * 1000)
      setPhoneOtpStep("otp")
      setOtp("")
      if (data.account_hint === "existing") {
        setError(null)
        // Soft info: compte existant → OTP = connexion
        setExistingAccountHint(true)
      } else {
        setExistingAccountHint(false)
      }
    } catch {
      setError("Connexion impossible.")
    }
    setIsLoading(false)
  }

  const handleVerifyOtpSignup = async () => {
    if (otp.length !== 6) {
      setError("Entrez les 6 chiffres du code SMS")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode, otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Code invalide")
        setIsLoading(false)
        return
      }
      setPhoneVerified(true)
      setPhoneOtpStep("verified")
      if (data.resumed_login || data.is_new_user === false) {
        router.refresh()
        router.push(data.redirect_to || "/profil")
        return
      }
      setStep(2)
      router.refresh()
    } catch {
      setError("Vérification impossible.")
    }
    setIsLoading(false)
  }

  const completePhoneProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Session expirée. Reconnectez-vous.")
      return false
    }

    const mappedType = USER_TYPE_MAP[formData.userType] || formData.userType
    // NB: le numéro est déjà écrit (vérifié) par /api/auth/verify-otp via le
    // service_role. On ne le réécrit pas ici : le trigger DB gèle profiles.phone
    // pour les clients normaux (anti-takeover).
    const profileUpdate = {
      full_name: formData.name,
      user_type: mappedType,
      country: formData.country,
      city: formData.city,
      auth_method: "phone",
    }
    const completion = computeProfileCompletion({
      ...profileUpdate,
      phone: user.phone || phone,
      email: formData.linkedEmail || undefined,
    })

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        ...profileUpdate,
        profile_completion_pct: completion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (profileError) {
      setError(profileError.message)
      return false
    }

    await supabase.auth.updateUser({
      data: {
        full_name: formData.name,
        user_type: mappedType,
        country: formData.country,
        city: formData.city,
      },
    })

    // Lier email au téléphone déjà vérifié
    if (formData.linkedEmail?.trim()) {
      await fetch("/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.linkedEmail.trim(),
          phone: user.phone || phone,
          countryCode,
        }),
      })
    }

    if (formData.lat != null && formData.lon != null) {
      await fetch("/api/location/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: formData.lat,
          lon: formData.lon,
          city: formData.city,
          country:
            countries.find((c) => c.value === formData.country)?.label || formData.country,
          address: formData.address,
        }),
      })
    }

    router.push("/profil")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (step === 1 && authMethod === "phone") {
      if (phoneOtpStep === "input") {
        await handleSendOtp()
        return
      }
      if (phoneOtpStep === "otp") {
        await handleVerifyOtpSignup()
        return
      }
    }

    if (step < 3) {
      const next = step + 1
      setStep(next)
      if (next === 3) {
        void requestGps().then((loc) => {
          if (!loc) return
          const code = countryNameToCode(loc.country)
          setFormData((prev) => ({
            ...prev,
            city: loc.city || prev.city,
            country: code || prev.country,
            address: loc.address || prev.address,
            lat: loc.lat,
            lon: loc.lon,
          }))
        })
      }
      return
    }

    if (!formData.acceptTerms) {
      setError("Veuillez accepter les conditions")
      return
    }

    if (formData.lat == null && geoStatus !== "denied" && !formData.city) {
      setError("Touchez « Utiliser ma position » pour continuer")
      return
    }

    setIsLoading(true)

    if (authMethod === "phone" && phoneVerified) {
      await completePhoneProfile()
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    const mappedType = USER_TYPE_MAP[formData.userType] || formData.userType

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${window.location.origin}/profil`,
        data: {
          full_name: formData.name,
          user_type: mappedType,
          country: formData.country,
          city: formData.city,
          // Numéro NON vérifié : stocké comme "pending" seulement. Il ne doit
          // jamais servir de preuve d'identité ni être lu par send-otp (lookup).
          pending_phone: formData.phone || phone,
          auth_method: "email",
        },
      },
    })

    if (authError) {
      setError(mapAuthErrorMessage(authError.message))
      setIsLoading(false)
      return
    }

    if (data.user) {
      const phoneVal = formData.phone || phone
      const completion = computeProfileCompletion({
        full_name: formData.name,
        user_type: mappedType,
        country: formData.country,
        city: formData.city,
        email: formData.email,
        phone: phoneVal,
      })
      // On n'écrit PAS profiles.phone ici : un numéro saisi à l'inscription email
      // n'est pas vérifié. Il sera lié après un OTP réussi ("bind phone").
      await supabase
        .from("profiles")
        .update({
          profile_completion_pct: completion,
          auth_method: "email",
          linked_email: formData.email,
          email: formData.email,
        })
        .eq("id", data.user.id)

      if (data.session) {
        router.push("/profil")
      } else {
        localStorage.setItem("gwa_signup_email", formData.email)
        router.push("/auth/sign-up-success")
      }
    }
    setIsLoading(false)
  }

  const canProceed = () => {
    if (step === 1) {
      if (authMethod === "phone") {
        if (phoneOtpStep === "input") return phone.replace(/\D/g, "").length >= 8
        if (phoneOtpStep === "otp") return otp.length === 6
        return phoneVerified
      }
      return formData.email && formData.password.length >= 8
    }
    if (step === 2) {
      if (authMethod === "email" && !(formData.phone || phone).replace(/\D/g, "").length) return false
      return formData.name && formData.userType
    }
    return formData.acceptTerms
  }

  const stepButtonLabel = () => {
    if (isLoading) return step < 3 ? "..." : "Création..."
    if (step === 1 && authMethod === "phone") {
      if (phoneOtpStep === "input") return "Recevoir le code SMS"
      if (phoneOtpStep === "otp") return "Valider le code"
    }
    return step < 3 ? "Continuer" : "Créer mon compte"
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-5 pt-4 flex items-center justify-between">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
          className="p-2 -ml-2 active:opacity-60"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                step >= s ? "bg-neutral-900" : "bg-neutral-200",
              )}
            />
          ))}
        </div>
        <div className="w-9" />
      </header>

      <main className="flex-1 px-5 pt-8 pb-10">
        <HibpPasswordBanner />
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="mb-4">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Créer un compte</h1>
                <p className="text-neutral-500 text-sm">
                  Déjà un compte avec ce numéro ? On vous reconnecte tout de suite.
                </p>
              </div>

              <Tabs
                value={authMethod}
                onValueChange={(v) => {
                  setAuthMethod(v as "phone" | "email")
                  setError(null)
                  setPhoneOtpStep("input")
                }}
              >
                <TabsList className="w-full h-12 rounded-xl bg-neutral-100 p-1 mb-4">
                  <TabsTrigger value="phone" className="flex-1 rounded-lg gap-2 h-10">
                    <Phone className="h-4 w-4" />
                    Téléphone
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex-1 rounded-lg gap-2 h-10">
                    <Mail className="h-4 w-4" />
                    Email
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="phone" className="space-y-4 mt-0">
                  {phoneOtpStep === "input" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-neutral-700 mb-2 block">
                          Numéro mobile
                        </label>
                        <PhoneInput
                          value={phone}
                          onChange={setPhone}
                          countryCode={countryCode}
                          onCountryChange={setCountryCode}
                          disabled={isLoading}
                        />
                      </div>
                    </>
                  )}

                  {phoneOtpStep === "otp" && (
                    <>
                      {existingAccountHint && (
                        <div className="rounded-xl bg-[#E8F5E9] px-3 py-2.5 text-sm text-[#1F5C2E]">
                          Ce numéro a déjà un compte. Entrez le code SMS pour vous connecter.
                        </div>
                      )}
                      <p className="text-sm text-center text-neutral-500">
                        Code envoyé au{" "}
                        <span className="font-medium text-neutral-900">{maskedPhone}</span>
                      </p>
                      <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
                      {otpExpiresAt > 0 && (
                        <p className="text-center text-sm text-neutral-500">
                          Expire dans <OtpCountdown expiresAt={otpExpiresAt} />
                        </p>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="email" className="space-y-4 mt-0">
                  <div>
                    <label htmlFor="email" className="text-sm font-medium text-neutral-700 mb-2 block">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required={authMethod === "email"}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="text-sm font-medium text-neutral-700 mb-2 block">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 8 caractères"
                        className="h-14 rounded-xl border-neutral-200 text-[15px] pr-12 focus:border-neutral-400 focus:ring-0"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={authMethod === "email"}
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-neutral-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-neutral-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Votre profil</h1>
                <p className="text-neutral-500">Parlez-nous de vous</p>
              </div>

              <div>
                <label htmlFor="name" className="text-sm font-medium text-neutral-700 mb-2 block">
                  Nom complet
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jean Kouame"
                  className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {authMethod === "phone" && (
                <div>
                  <label htmlFor="linkedEmail" className="text-sm font-medium text-neutral-700 mb-2 block">
                    Email (lié à votre numéro)
                  </label>
                  <Input
                    id="linkedEmail"
                    type="email"
                    placeholder="votre@email.com"
                    className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                    value={formData.linkedEmail}
                    onChange={(e) => setFormData({ ...formData, linkedEmail: e.target.value })}
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    Facultatif. Lié à {maskedPhone || phone}.
                  </p>
                </div>
              )}

              {authMethod === "email" && (
                <div>
                  <label htmlFor="signupPhone" className="text-sm font-medium text-neutral-700 mb-2 block">
                    Téléphone (obligatoire)
                  </label>
                  <PhoneInput
                    value={formData.phone || phone}
                    onChange={(v) => {
                      setPhone(v)
                      setFormData({ ...formData, phone: v })
                    }}
                    countryCode={countryCode}
                    onCountryChange={setCountryCode}
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    L&apos;email de connexion sera lié à ce numéro
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-neutral-700 mb-3 block">Vous êtes</label>
                <div className="grid grid-cols-2 gap-2">
                  {userTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, userType: type.value })}
                      className={cn(
                        "p-4 rounded-xl border-2 flex items-center gap-3 transition-all text-left",
                        formData.userType === type.value
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200",
                      )}
                    >
                      <type.icon
                        className={cn(
                          "h-5 w-5 flex-shrink-0",
                          formData.userType === type.value ? "text-neutral-900" : "text-neutral-400",
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          formData.userType === type.value ? "text-neutral-900" : "text-neutral-600",
                        )}
                      >
                        {type.label}
                      </span>
                      {formData.userType === type.value && (
                        <Check className="h-4 w-4 ml-auto text-neutral-900" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Localisation</h1>
                <p className="text-neutral-500">On détecte votre position. Pas besoin de saisir.</p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const loc = await requestGps()
                  if (!loc) {
                    setError("Autorisez la localisation pour continuer")
                    return
                  }
                  setError(null)
                  const code = countryNameToCode(loc.country)
                  setFormData((prev) => ({
                    ...prev,
                    city: loc.city || prev.city,
                    country: code || prev.country,
                    address: loc.address || prev.address,
                    lat: loc.lat,
                    lon: loc.lon,
                  }))
                }}
                className="w-full h-14 rounded-xl bg-[#2F7D32] text-white font-medium flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {geoStatus === "prompting" || geoStatus === "locating" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
                {formData.lat != null ? "Actualiser ma position" : "Utiliser ma position"}
              </button>

              {(formData.lat != null || gpsLocation) && (
                <LocationMapCard
                  lat={formData.lat ?? gpsLocation!.lat}
                  lon={formData.lon ?? gpsLocation!.lon}
                  accuracy={gpsLocation?.accuracy}
                  altitude={gpsLocation?.altitude}
                  address={formData.address || gpsLocation?.address}
                  city={formData.city || gpsLocation?.city}
                  country={
                    countries.find((c) => c.value === formData.country)?.label ||
                    gpsLocation?.country
                  }
                  label={gpsLocation?.label}
                  height={200}
                />
              )}

              {/* Fallback discret si GPS refusé */}
              {geoStatus === "denied" && (
                <div className="space-y-3">
                  <p className="text-xs text-amber-700">
                    Localisation refusée. Choisissez votre pays et votre ville.
                  </p>
                  <select
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full h-14 rounded-xl border border-neutral-200 bg-white px-4 text-[15px] focus:border-neutral-400 focus:outline-none"
                  >
                    <option value="">Pays</option>
                    {countries.map((country) => (
                      <option key={country.value} value={country.value}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    id="city"
                    type="text"
                    placeholder="Ville"
                    className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-xl">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, acceptTerms: checked as boolean })
                  }
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-sm leading-relaxed text-neutral-600">
                  J&apos;accepte les{" "}
                  <Link href="/conditions" className="font-medium text-neutral-900 underline">
                    conditions
                  </Link>{" "}
                  et la{" "}
                  <Link href="/confidentialite" className="font-medium text-neutral-900 underline">
                    politique de confidentialité
                  </Link>
                </label>
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full h-14 rounded-full text-[15px] font-semibold"
            disabled={!canProceed() || isLoading}
          >
            {stepButtonLabel()}
          </Button>
        </form>

        <p className="mt-8 text-center text-[15px]">
          <span className="text-neutral-500">Déjà inscrit ? </span>
          <Link href="/auth/login" className="font-semibold text-neutral-900">
            Connexion
          </Link>
        </p>
      </main>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
