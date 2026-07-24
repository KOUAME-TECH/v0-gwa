"use client"

import React, { Suspense, useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Eye, EyeOff, Phone, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { mapAuthErrorMessage } from "@/lib/auth/auth-errors"
import { PhoneInput } from "@/components/auth/phone-input"
import { OtpInput, OtpCountdown } from "@/components/auth/otp-input"
import { maskPhone } from "@/lib/auth/phone"
import { HibpPasswordBanner } from "@/components/auth/hibp-password-banner"
import { GwaMark } from "@/components/brand/gwa-mark"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect")

  const [authTab, setAuthTab] = useState<"phone" | "email">("phone")
  const [phoneStep, setPhoneStep] = useState<"input" | "otp">("input")
  const [countryCode, setCountryCode] = useState("ci")
  const [phone, setPhone] = useState("")
  const [maskedPhone, setMaskedPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [otpExpiresAt, setOtpExpiresAt] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)

  const [linkedEmailMasked, setLinkedEmailMasked] = useState("")
  const [otpChannel, setOtpChannel] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectAfterAuth = useCallback(
    async (fallbackPath?: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(redirectTo || fallbackPath || "/profil")
        return
      }

      // Prefer server gate (service role) — reliable even if RLS regresses
      let isAdmin = false
      try {
        const res = await fetch("/api/auth/admin-status")
        const data = await res.json()
        isAdmin = !!data.isAdmin
      } catch {
        const { data: adminRole } = await supabase
          .from("admin_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle()
        isAdmin = !!adminRole
      }

      if (isAdmin) {
        router.push("/admin")
        return
      }

      router.push(redirectTo || fallbackPath || "/profil")
    },
    [router, redirectTo],
  )

  const handleSendOtp = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === "SMS_SEND_FAILED") {
          setError(
            "SMS indisponible pour le moment. Connectez-vous par email, ou réessayez plus tard.",
          )
        } else {
          setError(data.error || "Envoi impossible")
        }
        setIsLoading(false)
        return
      }
      setMaskedPhone(data.masked_phone || maskPhone(data.phone))
      setLinkedEmailMasked(data.linked_email_masked || "")
      setOtpChannel(data.channel || "sms")
      setOtpExpiresAt(Date.now() + (data.expires_in || 600) * 1000)
      setResendCooldown(Number(data.resend_after) || 60)
      setPhoneStep("otp")
      setOtp("")
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.")
    }
    setIsLoading(false)
  }

  // Compte à rebours réel pour « Renvoyer »
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => {
      setResendCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleVerifyOtp = async () => {
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
      router.refresh()
      await redirectAfterAuth(data.redirect_to)
    } catch {
      setError("Vérification impossible. Réessayez.")
    }
    setIsLoading(false)
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return
    await handleSendOtp()
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(mapAuthErrorMessage(authError.message))
        setIsLoading(false)
        return
      }

      if (data.user) {
        await redirectAfterAuth()
      }
    } catch {
      setError("Connexion au serveur impossible. Vérifiez votre réseau.")
    }
    setIsLoading(false)
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#FFF8F0]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% -10%, #E8F0E9 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, #F5E6C8 0%, transparent 50%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-5 pt-4">
        <Link href="/" className="inline-flex p-2 -ml-2 active:opacity-60" aria-label="Retour">
          <ArrowLeft className="h-5 w-5 text-[#1F5C2E]" />
        </Link>
        <GwaMark size={28} showWordmark wordmarkClassName="text-xl tracking-tight text-[#1F5C2E]" />
        <span className="w-9" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-5 pb-10 pt-6">
        <div className="mb-7">
          <h1 className="font-display text-[1.75rem] leading-tight text-[#111827]">
            Content de te revoir
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4B5563]">
            Entre avec ton numéro ou ton email — comme d’habitude.
          </p>
        </div>

        <HibpPasswordBanner />

        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50/90 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <Tabs
          value={authTab}
          onValueChange={(v) => {
            setAuthTab(v as "phone" | "email")
            setError(null)
            setPhoneStep("input")
          }}
          className="w-full"
        >
          <TabsList className="mb-6 h-12 w-full rounded-2xl bg-white/80 p-1 ring-1 ring-[#1F5C2E]/10">
            <TabsTrigger value="phone" className="h-10 flex-1 gap-2 rounded-xl data-[state=active]:bg-[#1F5C2E] data-[state=active]:text-white">
              <Phone className="h-4 w-4" />
              Téléphone
            </TabsTrigger>
            <TabsTrigger value="email" className="h-10 flex-1 gap-2 rounded-xl data-[state=active]:bg-[#1F5C2E] data-[state=active]:text-white">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="mt-0 space-y-5">
            {phoneStep === "input" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#374151]">
                    Ton numéro
                  </label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    countryCode={countryCode}
                    onCountryChange={setCountryCode}
                    disabled={isLoading}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
                    On t’envoie un code SMS. Utilise le même numéro qu’à l’inscription.
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-12 w-full rounded-xl bg-[#1F5C2E] text-[15px] font-semibold hover:bg-[#184a25]"
                  disabled={isLoading || phone.replace(/\D/g, "").length < 8}
                  onClick={handleSendOtp}
                >
                  {isLoading ? "Envoi…" : "Recevoir le code"}
                </Button>
              </>
            ) : (
              <>
                <div className="mb-2 text-center">
                  <p className="text-sm text-[#4B5563]">
                    Code envoyé au{" "}
                    <span className="font-semibold text-[#111827]">{maskedPhone}</span>
                  </p>
                  {linkedEmailMasked ? (
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Compte lié : {linkedEmailMasked}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 text-sm text-[#1F5C2E] underline underline-offset-2"
                    onClick={() => {
                      setPhoneStep("input")
                      setOtp("")
                      setResendCooldown(0)
                    }}
                  >
                    Changer de numéro
                  </button>
                </div>

                <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

                <div className="text-center text-sm">
                  <span className="text-[#6B7280]">Expire dans </span>
                  {otpExpiresAt > 0 && (
                    <OtpCountdown expiresAt={otpExpiresAt} />
                  )}
                </div>

                <Button
                  type="button"
                  className="h-12 w-full rounded-xl bg-[#1F5C2E] text-[15px] font-semibold hover:bg-[#184a25]"
                  disabled={isLoading || otp.length !== 6}
                  onClick={handleVerifyOtp}
                >
                  {isLoading ? "Vérification…" : "Valider"}
                </Button>

                <p className="text-center text-sm text-[#6B7280]">
                  Pas reçu ?{" "}
                  <button
                    type="button"
                    className="font-medium text-[#1F5C2E] disabled:opacity-40"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={handleResendOtp}
                  >
                    {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : "Renvoyer"}
                  </button>
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-0">
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#374151]">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ex. ama@email.com"
                  className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[15px] focus:border-[#1F5C2E] focus:ring-[#1F5C2E]/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-[#374151]">
                    Mot de passe
                  </label>
                  <Link href="/auth/forgot-password" className="text-sm font-medium text-[#1F5C2E]">
                    Oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ton mot de passe"
                    className="h-12 rounded-xl border-[#E5E7EB] bg-white pr-12 text-[15px] focus:border-[#1F5C2E] focus:ring-[#1F5C2E]/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 active:opacity-60"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-[#9CA3AF]" />
                    ) : (
                      <Eye className="h-5 w-5 text-[#9CA3AF]" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-12 w-full rounded-xl bg-[#1F5C2E] text-[15px] font-semibold hover:bg-[#184a25]"
                disabled={isLoading}
              >
                {isLoading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-8 text-center text-[15px]">
          <span className="text-[#6B7280]">Pas encore sur GWA ? </span>
          <Link href="/auth/signup" className="font-semibold text-[#1F5C2E]">
            Créer un compte
          </Link>
        </p>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
