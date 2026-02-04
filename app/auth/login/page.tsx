"use client"

import React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
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
        if (authError.message === "Invalid login credentials") {
          setError("Email ou mot de passe incorrect")
        } else {
          setError(authError.message)
        }
        setIsLoading(false)
        return
      }

      if (data.user) {
        const { data: adminRole } = await supabase
          .from("admin_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("is_active", true)
          .single()

        if (adminRole) {
          router.push("/admin")
          return
        }

        router.push("/profil")
      }
    } catch {
      setError("Une erreur est survenue")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-4">
        <Link href="/" className="inline-flex p-2 -ml-2 active:opacity-60">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pt-8 pb-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Connexion</h1>
          <p className="text-neutral-500">Heureux de vous revoir</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

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
                Oublie?
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

        <p className="mt-8 text-center text-[15px]">
          <span className="text-neutral-500">Pas de compte? </span>
          <Link href="/auth/signup" className="font-semibold text-neutral-900">
            Inscription
          </Link>
        </p>
      </main>

      {/* Footer Logo */}
      <div className="py-6 text-center">
        <span className="text-2xl font-bold tracking-tight">GWA</span>
      </div>
    </div>
  )
}
