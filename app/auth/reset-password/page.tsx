"use client"

import React, { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { mapAuthErrorMessage } from "@/lib/auth/auth-errors"

function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setHasSession(!!user)
      setCheckingSession(false)
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(mapAuthErrorMessage(updateError.message))
        setIsLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()

      router.push(adminRole ? "/admin" : "/profil")
      router.refresh()
    } catch {
      setError("Mise à jour impossible. Réessayez.")
    }
    setIsLoading(false)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-5 pt-4">
          <Link href="/auth/login" className="inline-flex p-2 -ml-2 active:opacity-60">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </header>
        <main className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Lien expiré</h1>
          <p className="text-neutral-500 mb-6">
            Ce lien de réinitialisation n&apos;est plus valide. Demandez un nouveau lien.
          </p>
          <Button asChild className="w-full h-14 rounded-full text-[15px] font-semibold">
            <Link href="/auth/forgot-password">Nouveau lien</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-5 pt-4">
        <Link href="/auth/login" className="inline-flex p-2 -ml-2 active:opacity-60">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </header>

      <main className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Nouveau mot de passe</h1>
          <p className="text-neutral-500">Choisissez un mot de passe sécurisé pour votre compte.</p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="text-sm font-medium text-neutral-700 mb-2 block">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 caractères"
                className="h-14 rounded-xl border-neutral-200 text-[15px] pr-12 focus:border-neutral-400 focus:ring-0"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
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

          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-neutral-700 mb-2 block"
            >
              Confirmer le mot de passe
            </label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Répétez le mot de passe"
              className="h-14 rounded-xl border-neutral-200 text-[15px] focus:border-neutral-400 focus:ring-0"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 rounded-full text-[15px] font-semibold mt-4"
            disabled={isLoading}
          >
            {isLoading ? "Enregistrement..." : "Enregistrer le mot de passe"}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
