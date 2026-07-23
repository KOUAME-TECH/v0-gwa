"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, Phone, Link2, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/auth/phone-input"
import { OtpInput, OtpCountdown } from "@/components/auth/otp-input"
import { maskPhone } from "@/lib/auth/phone"
import { toast } from "sonner"

/**
 * Après connexion : lier email ↔ téléphone sans bloquer l'accès.
 */
export default function LierComptePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [linkedEmail, setLinkedEmail] = useState("")
  const [countryCode, setCountryCode] = useState("ci")
  const [newPhone, setNewPhone] = useState("")
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState("")
  const [masked, setMasked] = useState("")
  const [expiresAt, setExpiresAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [showKyc, setShowKyc] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/auth/login?redirect=/profil/lier")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, linked_email, phone, phone_verified, is_verified")
        .eq("id", user.id)
        .maybeSingle()
      const { data: kyc } = await supabase
        .from("verification_requests")
        .select("status")
        .eq("user_id", user.id)
        .eq("request_type", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      setEmail(user.email || profile?.email || "")
      setLinkedEmail(profile?.linked_email || profile?.email || user.email || "")
      setPhone(profile?.phone || user.phone || "")
      setPhoneVerified(profile?.phone_verified === true)
      const status = (kyc?.status as "pending" | "approved" | "rejected" | null) || null
      setShowKyc(
        profile?.is_verified !== true &&
          status !== "pending" &&
          status !== "approved",
      )
      setLoading(false)
    })()
  }, [router])

  const sendBindOtp = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newPhone,
          countryCode,
          intent: "bind",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Envoi impossible")
        setBusy(false)
        return
      }
      setMasked(data.masked_phone || maskPhone(data.phone))
      setExpiresAt(Date.now() + (data.expires_in || 600) * 1000)
      setOtpStep(true)
      setOtp("")
    } catch {
      setError("Réseau indisponible")
    }
    setBusy(false)
  }

  const verifyBindOtp = async () => {
    if (otp.length !== 6) {
      setError("Entrez les 6 chiffres")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: newPhone, countryCode, otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Code invalide")
        setBusy(false)
        return
      }
      toast.success("Téléphone lié à votre compte")
      setPhone(data.user?.phone || newPhone)
      setPhoneVerified(true)
      setOtpStep(false)
    } catch {
      setError("Vérification impossible")
    }
    setBusy(false)
  }

  const linkEmail = async () => {
    const value = linkedEmail.trim().toLowerCase()
    if (!value || !value.includes("@")) {
      setError("Email invalide")
      return
    }
    setEmailBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error: updErr } = await supabase.auth.updateUser({ email: value })
      if (updErr) {
        setError(updErr.message)
        setEmailBusy(false)
        return
      }

      await supabase
        .from("profiles")
        .update({
          linked_email: value,
          email: value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      toast.success("Email enregistré — confirmez-le via le lien reçu")
      setEmail(value)
    } catch {
      setError("Impossible de lier l'email")
    }
    setEmailBusy(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-5">
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
        <Link href="/profil/edit" className="p-2 -ml-2 active:opacity-60" aria-label="Retour paramètres">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Lier mon compte</h1>
      </header>

      <div className="px-5 pt-6 space-y-8 max-w-lg mx-auto">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Connectez-vous toujours avec téléphone <em>ou</em> email. Liez les deux
          quand vous voulez — sans bloquer l&apos;accès.
        </p>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#1F5C2E] font-medium">
            <Phone className="h-4 w-4" />
            Téléphone
          </div>
          {phoneVerified && phone ? (
            <div className="flex items-center gap-2 rounded-2xl bg-[#E8F5E9] px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-[#2F7D32] shrink-0" />
              <span>{maskPhone(phone)} — vérifié</span>
            </div>
          ) : otpStep ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                Code envoyé au {masked}
              </p>
              <OtpInput value={otp} onChange={setOtp} />
              <OtpCountdown expiresAt={expiresAt} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                className="w-full h-11 rounded-xl bg-[#2F7D32] hover:bg-[#256025]"
                disabled={busy}
                onClick={verifyBindOtp}
              >
                {busy ? "Vérification…" : "Confirmer le numéro"}
              </Button>
              <button
                type="button"
                className="text-sm text-neutral-500 underline"
                onClick={() => setOtpStep(false)}
              >
                Changer de numéro
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <PhoneInput
                value={newPhone}
                onChange={setNewPhone}
                countryCode={countryCode}
                onCountryChange={setCountryCode}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                className="w-full h-11 rounded-xl bg-[#2F7D32] hover:bg-[#256025]"
                disabled={busy || !newPhone}
                onClick={sendBindOtp}
              >
                {busy ? "Envoi…" : "Recevoir un code SMS"}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#1F5C2E] font-medium">
            <Mail className="h-4 w-4" />
            Email
          </div>
          <Input
            type="email"
            placeholder="vous@email.com"
            value={linkedEmail}
            onChange={(e) => setLinkedEmail(e.target.value)}
            className="h-11 rounded-xl"
          />
          {email && (
            <p className="text-xs text-neutral-500">
              Actuel : {email}
            </p>
          )}
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl border-[#2F7D32] text-[#1F5C2E]"
            disabled={emailBusy}
            onClick={linkEmail}
          >
            {emailBusy ? "Enregistrement…" : "Lier cet email"}
          </Button>
        </section>

        {showKyc && (
          <section className="rounded-2xl bg-[#FFF6E5] p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium text-[#1F5C2E]">
              <Link2 className="h-4 w-4" />
              Vérification d&apos;identité
            </div>
            <p className="text-sm text-neutral-600">
              Optionnel mais utile pour le badge et le SCG — pièce + selfie.
            </p>
            <Link href="/profil/verification">
              <Button className="mt-2 w-full h-11 rounded-xl bg-[#F5A623] hover:bg-[#e09510] text-white">
                Demander la vérification
              </Button>
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
