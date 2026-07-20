"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Mail,
  MapPin,
  Send,
  MessageCircle,
  ShieldCheck,
  FileText,
} from "lucide-react"
import {
  WHATSAPP_DISPLAY,
  WHATSAPP_LINK,
  CONTACT_EMAIL,
} from "@/lib/contact"


export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message"),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Envoi impossible")
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'envoi")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#FFF6E5]">
      {/* Header mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] safe-top">
        <div className="flex items-center gap-2 h-14 px-3">
          <Link
            href="/profil"
            className="p-2 -ml-1 rounded-full active:bg-neutral-100"
            aria-label="Retour à Moi"
          >
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#111827]">Aide &amp; Contact</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <p className="text-[#4B5563] text-[15px]">
          Une question sur GWA (commandes, escrow, paiement, Score de Confiance) ?
          L&apos;équipe GWA vous répond. Le moyen le plus rapide reste WhatsApp.
        </p>

        {/* WhatsApp — canal prioritaire */}
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl bg-[#2F7D32] text-white p-4 shadow-sm active:scale-[0.99] transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Écrire sur WhatsApp</p>
            <p className="text-sm text-white/85">{WHATSAPP_DISPLAY}</p>
          </div>
          <Send className="h-5 w-5 flex-shrink-0" />
        </a>

        {/* Coordonnées */}
        <div className="grid gap-3">
          <div className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#2F7D32]/10 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-[#2F7D32]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[#111827] mb-0.5">Email</h3>
              <p className="text-sm text-[#4B5563] break-all">{CONTACT_EMAIL}</p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Les messages envoyés via le formulaire ci-dessous arrivent
                directement dans la boîte de l&apos;équipe GWA.
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#F39A1F]/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-[#F39A1F]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[#111827] mb-0.5">Bureau</h3>
              <p className="text-sm text-[#4B5563]">
                KOUAME CORPORATION — GWA
              </p>
              <p className="text-sm text-[#4B5563]">Abidjan, Côte d&apos;Ivoire</p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#111827] mb-1">
            Envoyez-nous un message
          </h2>
          <p className="text-sm text-[#4B5563] mb-4">
            Nous répondons généralement sous 24 h.
          </p>

          {submitted ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-[#2F7D32]/10 flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-[#2F7D32]" />
              </div>
              <h3 className="text-lg font-bold mb-1 text-[#111827]">
                Message envoyé !
              </h3>
              <p className="text-[#4B5563] text-sm">
                L&apos;équipe GWA vous répondra très bientôt.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Votre nom"
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  placeholder="votre@email.com"
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Sujet</Label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="En quoi pouvons-nous vous aider ?"
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Votre message…"
                  rows={5}
                  required
                  className="rounded-xl resize-none"
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button
                type="submit"
                className="w-full h-11 rounded-full bg-[#2F7D32] hover:bg-[#256025]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Envoi en cours…" : "Envoyer le message"}
              </Button>
            </form>
          )}
        </div>

        {/* Liens légaux */}
        <div className="rounded-2xl bg-white overflow-hidden shadow-sm">
          <Link
            href="/conditions"
            className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100 active:bg-neutral-50"
          >
            <FileText className="h-5 w-5 text-neutral-500" />
            <span className="flex-1 font-medium text-[15px] text-[#111827]">
              Conditions d&apos;utilisation
            </span>
          </Link>
          <Link
            href="/confidentialite"
            className="flex items-center gap-3 px-4 py-3.5 active:bg-neutral-50"
          >
            <ShieldCheck className="h-5 w-5 text-neutral-500" />
            <span className="flex-1 font-medium text-[15px] text-[#111827]">
              Politique de confidentialité
            </span>
          </Link>
        </div>

        <p className="text-center text-xs text-neutral-400 pb-4">
          KOUAME CORPORATION · GWA · Abidjan, Côte d&apos;Ivoire
        </p>
      </main>
    </div>
  )
}
