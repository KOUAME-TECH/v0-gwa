"use client"

import Link from "next/link"
import { YellyAideButton } from "@/components/yelly/yelly-aide-button"
import { WHATSAPP_LINK } from "@/lib/contact"
import { MessageCircle, HelpCircle } from "lucide-react"

const FAQ = [
  {
    q: "C’est quoi l’argent protégé ?",
    a: "Tu paies, l’argent est gardé jusqu’à ce que tu confirmes la réception. Puis le vendeur est payé.",
  },
  {
    q: "Comment vendre ?",
    a: "Publier → nom, prix, photos, ville. Les acheteurs te trouvent dans Boutique.",
  },
  {
    q: "C’est quoi le score de confiance ?",
    a: "Il montre ta fiabilité. Il monte avec un profil complet et de bonnes livraisons.",
  },
  {
    q: "Comment rejoindre une coop ?",
    a: "Demande le lien d’invitation à un admin coop, ou crée la tienne depuis Espace coopérative.",
  },
]

export default function AidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24 px-4 pt-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-[#C27D10] flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4" aria-hidden />
          Aide GWA
        </p>
        <h1 className="text-2xl font-bold text-[#1F5C2E]">Besoin d’un coup de main ?</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Réponses courtes. Ou parle à Yelly / WhatsApp.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <YellyAideButton source="aide_page" />
        <a
          href={`${WHATSAPP_LINK}?text=${encodeURIComponent("Bonjour GWA, j’ai besoin d’aide.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          WhatsApp
        </a>
      </div>

      <ul className="space-y-3">
        {FAQ.map((item) => (
          <li
            key={item.q}
            className="rounded-2xl bg-white p-4 ring-1 ring-[#1F5C2E]/10"
          >
            <h2 className="text-base font-semibold text-[#1a1a1a]">{item.q}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">{item.a}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-[#6B7280]">
        <Link href="/profil" className="font-medium text-[#1F5C2E] underline">
          Retour profil
        </Link>
        {" · "}
        <Link href="/contact" className="font-medium text-[#1F5C2E] underline">
          Contact
        </Link>
      </p>
    </div>
  )
}
