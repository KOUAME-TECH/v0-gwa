"use client"

import React, { Suspense } from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Eye, EyeOff, Sprout, Palette, ShoppingCart, Users, Building2, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const userTypes = [
  { value: "farmer", label: "Producteur", icon: Sprout },
  { value: "artisan", label: "Artisan", icon: Palette },
  { value: "buyer", label: "Acheteur", icon: ShoppingCart },
  { value: "cooperative", label: "Cooperative", icon: Users },
  { value: "business", label: "Entreprise", icon: Building2 },
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

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedType = searchParams.get("type")
  
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    userType: preselectedType || "",
    country: "",
    city: "",
    acceptTerms: false,
  })

  useEffect(() => {
    if (preselectedType && userTypes.find(t => t.value === preselectedType)) {
      setFormData(prev => ({ ...prev, userType: preselectedType }))
    }
  }, [preselectedType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (step < 3) {
      setStep(step + 1)
      return
    }

    if (!formData.acceptTerms) {
      setError("Veuillez accepter les conditions")
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/profil`,
        data: {
          full_name: formData.name,
          user_type: formData.userType,
          country: formData.country,
          city: formData.city,
        },
      },
    })

    if (authError) {
      setError(authError.message.includes("already registered") ? "Cet email est déjà utilisé" : authError.message)
      setIsLoading(false)
      return
    }

    if (data.user) {
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
    if (step === 1) return formData.email && formData.password.length >= 8
    if (step === 2) return formData.name && formData.userType
    return formData.acceptTerms
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-4 flex items-center justify-between">
        <button 
          onClick={() => step > 1 ? setStep(step - 1) : router.back()} 
          className="p-2 -ml-2 active:opacity-60"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn(
              "h-1.5 w-8 rounded-full transition-colors",
              step >= s ? "bg-neutral-900" : "bg-neutral-200"
            )} />
          ))}
        </div>
        <div className="w-9" />
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pt-8 pb-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Créer un compte</h1>
                <p className="text-neutral-500">Rejoignez GWA</p>
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium text-neutral-700 mb-2 block">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-sm font-medium text-neutral-700 mb-2 block">Mot de passe</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 caractères"
                    className="h-14 rounded-xl border-neutral-200 text-[15px] pr-12 focus:border-neutral-400 focus:ring-0"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-neutral-400" /> : <Eye className="h-5 w-5 text-neutral-400" />}
                  </button>
                </div>
                {formData.password && formData.password.length < 8 && (
                  <p className="text-xs text-neutral-500 mt-2">Encore {8 - formData.password.length} caractères</p>
                )}
              </div>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Votre profil</h1>
                <p className="text-neutral-500">Parlez-nous de vous</p>
              </div>

              <div>
                <label htmlFor="name" className="text-sm font-medium text-neutral-700 mb-2 block">Nom complet</label>
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
                          : "border-neutral-200"
                      )}
                    >
                      <type.icon className={cn(
                        "h-5 w-5 flex-shrink-0",
                        formData.userType === type.value ? "text-neutral-900" : "text-neutral-400"
                      )} />
                      <span className={cn(
                        "text-sm font-medium",
                        formData.userType === type.value ? "text-neutral-900" : "text-neutral-600"
                      )}>
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

          {/* Step 3 */}
          {step === 3 && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Localisation</h1>
                <p className="text-neutral-500">Où êtes-vous situé ?</p>
              </div>

              <div>
                <label htmlFor="country" className="text-sm font-medium text-neutral-700 mb-2 block">Pays</label>
                <select
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full h-14 rounded-xl border border-neutral-200 bg-white px-4 text-[15px] focus:border-neutral-400 focus:outline-none"
                >
                  <option value="">Sélectionnez</option>
                  {countries.map((country) => (
                    <option key={country.value} value={country.value}>{country.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="city" className="text-sm font-medium text-neutral-700 mb-2 block">Ville</label>
                <Input
                  id="city"
                  type="text"
                  placeholder="Abidjan, Dakar, etc."
                  className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-xl">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked as boolean })}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-sm leading-relaxed text-neutral-600">
                  J'accepte les{" "}
                  <Link href="/legal/terms" className="font-medium text-neutral-900 underline">conditions</Link>
                  {" "}et la{" "}
                  <Link href="/legal/privacy" className="font-medium text-neutral-900 underline">politique de confidentialité</Link>
                </label>
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full h-14 rounded-full text-[15px] font-semibold"
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? "Création..." : step < 3 ? "Continuer" : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-8 text-center text-[15px]">
          <span className="text-neutral-500">Déjà inscrit ? </span>
          <Link href="/auth/login" className="font-semibold text-neutral-900">Connexion</Link>
        </p>
      </main>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="w-8 h-8 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" /></div>}>
      <SignupForm />
    </Suspense>
  )
}
