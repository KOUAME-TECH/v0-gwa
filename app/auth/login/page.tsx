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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-5 pt-4">
        <Link href="/" className="inline-flex p-2 -ml-2 active:opacity-60">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </header>

      <main className="flex-1 px-5 pt-8 pb-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Connexion</h1>
          <p className="text-neutral-500">Heureux de vous revoir</p>
        </div>

        <HibpPasswordBanner />

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
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
          <TabsList className="w-full h-12 rounded-xl bg-neutral-100 p-1 mb-6">
            <TabsTrigger value="phone" className="flex-1 rounded-lg gap-2 h-10">
              <Phone className="h-4 w-4" />
              Téléphone
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1 rounded-lg gap-2 h-10">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="space-y-5 mt-0">
            {phoneStep === "input" ? (
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
                  <p className="text-xs text-neutral-400 mt-2">
                    Un code SMS sera envoyé. Le numéro doit être lié à
                    l&apos;email de votre première inscription.
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full h-14 rounded-full text-[15px] font-semibold"
                  disabled={isLoading || phone.replace(/\D/g, "").length < 8}
                  onClick={handleSendOtp}
                >
                  {isLoading ? "Envoi SMS..." : "Recevoir le code SMS"}
                </Button>
              </>
            ) : (
              <>
                <div className="text-center mb-2">
                  <p className="text-sm text-neutral-500">
                    Code SMS envoyé au{" "}
                    <span className="font-medium text-neutral-900">{maskedPhone}</span>
                  </p>
                  {linkedEmailMasked ? (
                    <p className="text-xs text-neutral-400 mt-1">
                      Compte lié : {linkedEmailMasked}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="text-sm text-neutral-500 underline mt-1"
                    onClick={() => {
                      setPhoneStep("input")
                      setOtp("")
                      setResendCooldown(0)
                    }}
                  >
                    Modifier le numéro
                  </button>
                </div>

                <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

                <div className="text-center text-sm">
                  <span className="text-neutral-500">Expire dans </span>
                  {otpExpiresAt > 0 && (
                    <OtpCountdown expiresAt={otpExpiresAt} />
                  )}
                </div>

                <Button
                  type="button"
                  className="w-full h-14 rounded-full text-[15px] font-semibold"
                  disabled={isLoading || otp.length !== 6}
                  onClick={handleVerifyOtp}
                >
                  {isLoading ? "Vérification..." : "Valider le code"}
                </Button>

                <p className="text-center text-sm text-neutral-500">
                  Pas reçu ?{" "}
                  <button
                    type="button"
                    className="font-medium text-neutral-900 disabled:opacity-40"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={handleResendOtp}
                  >
                    {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : "Renvoyer le code"}
                  </button>
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-0">
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-neutral-700 mb-2 block">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="text-sm font-medium text-neutral-700">
                    Mot de passe
                  </label>
                  <Link href="/auth/forgot-password" className="text-sm font-medium text-neutral-500">
                    Oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe"
                    className="h-14 rounded-xl border-neutral-200 text-[15px] pr-12 focus:border-neutral-400 focus:ring-0"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 active:opacity-60"
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

              <Button
                type="submit"
                className="w-full h-14 rounded-full text-[15px] font-semibold mt-4"
                disabled={isLoading}
              >
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-8 text-center text-[15px]">
          <span className="text-neutral-500">Pas de compte ? </span>
          <Link href="/auth/signup" className="font-semibold text-neutral-900">
            Inscription
          </Link>
        </p>
      </main>

      <div className="py-6 flex justify-center">
        <GwaMark size={40} showWordmark wordmarkClassName="text-2xl tracking-tight" />
      </div>
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
