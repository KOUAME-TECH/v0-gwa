"use client"

import React, { Suspense, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) {
        setError(resetError.message)
        setIsLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError("Envoi impossible. Vérifiez votre réseau.")
    }
    setIsLoading(false)
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
          <h1 className="text-3xl font-bold tracking-tight mb-2">Mot de passe oublié</h1>
          <p className="text-neutral-500">
            Entrez votre email. Nous vous enverrons un lien pour définir un nouveau mot de passe.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {sent ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-green-50 text-green-700 text-sm">
              Si un compte existe pour <span className="font-medium">{email}</span>, un email de
              réinitialisation vient d&apos;être envoyé. Vérifiez aussi les spams.
            </div>
            <Button asChild className="w-full h-14 rounded-full text-[15px] font-semibold">
              <Link href="/auth/login">Retour à la connexion</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <Button
              type="submit"
              className="w-full h-14 rounded-full text-[15px] font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  )
}
