"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ShoppingBag,
  MessageCircle,
  User,
  Camera,
  Mic,
  Check,
  ChevronRight,
  Shield,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Square,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { GwaMark } from "@/components/brand/gwa-mark"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { WHATSAPP_LINK } from "@/lib/contact"

type Screen = "accueil" | "vendre" | "payer" | "avance" | "moi"

const ESCROW_STEPS = [
  { id: "payer", label: "Payer" },
  { id: "sequestre", label: "Séquestre" },
  { id: "livre", label: "Livré" },
  { id: "confirme", label: "Confirmé" },
  { id: "libere", label: "Libéré" },
] as const

function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = "fr-FR"
  u.rate = 0.92
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  window.speechSynthesis.speak(u)
}

function ExplainButton({ text, label = "Me l’expliquer" }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false)

  const toggle = () => {
    if (playing) {
      window.speechSynthesis?.cancel()
      setPlaying(false)
      return
    }
    setPlaying(true)
    speak(text, () => setPlaying(false))
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
        playing
          ? "bg-[#C27D10]/15 text-[#C27D10] ring-1 ring-[#C27D10]/30"
          : "bg-[#1F5C2E]/10 text-[#1F5C2E]",
      )}
      aria-pressed={playing}
      aria-label={playing ? "Arrêter" : label}
    >
      {playing ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <AudioWaveIcon size="xs" variant="synth" />
      )}
      {playing ? "…" : label}
    </button>
  )
}

function DemoNav({
  screen,
  onChange,
}: {
  screen: Screen
  onChange: (s: Screen) => void
}) {
  const items = [
    { id: "accueil" as const, label: "Marché", icon: ShoppingBag, map: "accueil" as Screen },
    { id: "messages" as const, label: "Messages", icon: MessageCircle, map: "moi" as Screen },
    { id: "moi" as const, label: "Moi", icon: User, map: "moi" as Screen },
  ]

  // Messages tab goes to a soft stub inside Moi for the demo
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-md safe-pb"
      aria-label="Navigation démo"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active =
            item.id === "accueil"
              ? screen === "accueil" || screen === "vendre" || screen === "payer" || screen === "avance"
              : screen === "moi"
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.map)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-[#1F5C2E]" : "text-[#6B7280]",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default function UxBetaDemoPage() {
  const [screen, setScreen] = useState<Screen>("accueil")
  const [escrowStep, setEscrowStep] = useState(0)
  const [published, setPublished] = useState(false)
  const [price, setPrice] = useState("1500")
  const [qty, setQty] = useState("50")

  const go = useCallback((s: Screen) => {
    window.speechSynthesis?.cancel()
    setScreen(s)
  }, [])

  return (
    <div className="min-h-dvh bg-[#F7F3EB] text-[#1C1917] pb-24">
      {/* Banner démo */}
      <div className="sticky top-0 z-40 border-b border-[#C27D10]/25 bg-[#FFF8E8] px-3 py-2">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#C27D10]">
            Démo UX bêta — prototype interactif (pas prod)
          </p>
          <Link href="/" className="text-[11px] text-[#1F5C2E] underline-offset-2 hover:underline">
            Quitter
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        {screen === "accueil" && (
          <section className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 80% 50% at 20% 0%, #1F5C2E22, transparent), radial-gradient(ellipse 60% 40% at 90% 20%, #C27D1020, transparent)",
              }}
            />
            <header className="relative px-5 pt-6 pb-4">
              <GwaMark size={40} showWordmark wordmarkClassName="text-[1.75rem] tracking-tight" />
              <h1 className="mt-5 font-serif text-[1.85rem] leading-[1.15] tracking-tight text-[#1F5C2E]">
                Vendre. Être payé.
                <br />
                Avancer sereinement.
              </h1>
              <p className="mt-2 max-w-[22rem] text-[15px] leading-relaxed text-[#4B5563]">
                Trois gestes. Pas de jargon. L’argent reste protégé jusqu’à la livraison.
              </p>
              <div className="mt-3">
                <ExplainButton
                  text="Bienvenue sur GWA. Tu peux vendre tes produits et être payé à temps. Tu peux demander une avance sur facture. Tu peux suivre ton score de confiance. Choisis un bloc pour commencer."
                />
              </div>
            </header>

            <div className="relative space-y-3 px-4 pb-6">
              {[
                {
                  title: "Vendre et être payé à temps",
                  body: "Photo, voix, prix. L’acheteur paie ; tu touches après livraison.",
                  audio:
                    "Pour vendre : tu prends une photo, tu parles le prix et la quantité, tu publies. Quand quelqu’un achète, l’argent est gardé en sécurité jusqu’à ce que la livraison soit confirmée.",
                  action: () => go("vendre"),
                  icon: Camera,
                },
                {
                  title: "Demander une avance",
                  body: "Sur une vente confirmée, selon ton score SCG.",
                  audio:
                    "L’avance sur facture te donne de la trésorerie avant le paiement final. Ton score de confiance GWA doit être suffisant. Tu indiques le montant et tu peux expliquer ta demande à la voix.",
                  action: () => go("avance"),
                  icon: Wallet,
                },
                {
                  title: "Suivre mon score",
                  body: "Un coach clair : où tu en es, et 2 actions pour monter.",
                  audio:
                    "Le score de confiance GWA montre si tu livres bien et à temps. Ce n’est pas une punition. C’est un coach : on te dit deux actions simples pour l’améliorer.",
                  action: () => go("moi"),
                  icon: TrendingUp,
                },
              ].map((block) => {
                const Icon = block.icon
                return (
                  <button
                    key={block.title}
                    type="button"
                    onClick={block.action}
                    className="group flex w-full gap-3 rounded-2xl border border-[#1F5C2E]/12 bg-white/90 p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1F5C2E]/10 text-[#1F5C2E]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-[#111827]">{block.title}</span>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#9CA3AF] group-hover:text-[#1F5C2E]" />
                      </span>
                      <span className="mt-0.5 block text-sm text-[#6B7280]">{block.body}</span>
                      <span className="mt-2 block" onClick={(e) => e.stopPropagation()}>
                        <ExplainButton text={block.audio} />
                      </span>
                    </span>
                  </button>
                )
              })}

              <div className="flex items-start gap-2 rounded-xl border border-[#1F5C2E]/15 bg-[#F0F7F2] px-3 py-2.5">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#1F5C2E]" />
                <p className="text-xs leading-relaxed text-[#374151]">
                  Paiements via <strong>Feexpay CI</strong> (agrégateur licencié). Fonds en séquestre
                  jusqu’à confirmation de livraison. Ton score SCG n’est pas vendu.
                </p>
              </div>
            </div>
          </section>
        )}

        {screen === "vendre" && (
          <section className="px-4 pt-4">
            <button
              type="button"
              onClick={() => go("accueil")}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#4B5563]"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <h2 className="font-serif text-2xl text-[#1F5C2E]">Publier une offre</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Un seul écran. Photo + voix + prix + quantité.</p>
            <div className="mt-2">
              <ExplainButton text="Prends une photo de ton produit. Enregistre une note vocale pour décrire. Indique le prix et la quantité. Puis appuie sur Publier." />
            </div>

            {!published ? (
              <div className="mt-5 space-y-4">
                <button
                  type="button"
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#1F5C2E]/30 bg-white text-[#1F5C2E]"
                >
                  <Camera className="h-8 w-8 opacity-70" />
                  <span className="text-sm font-medium">Ajouter une photo</span>
                  <span className="text-xs text-[#9CA3AF]">(démo — pas d’upload)</span>
                </button>

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#1F5C2E]/15 bg-white px-4 py-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F5C2E]/10">
                    <Mic className="h-5 w-5 text-[#1F5C2E]" />
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block text-sm font-medium">Note vocale</span>
                    <span className="text-xs text-[#6B7280]">Décris ton offre à voix haute</span>
                  </span>
                  <AudioWaveIcon size="sm" variant="recorded" />
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[#4B5563]">Prix (FCFA)</span>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-base"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[#4B5563]">Quantité (kg)</span>
                    <input
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-base"
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPublished(true)
                    speak(`Ton offre est publiée. ${qty} kilos à ${price} francs CFA.`)
                  }}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1F5C2E] text-base font-semibold text-white active:scale-[0.98]"
                >
                  Publier l’offre
                </button>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center rounded-2xl border border-[#1F5C2E]/20 bg-white p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1F5C2E] text-white">
                  <Check className="h-7 w-7" />
                </span>
                <p className="mt-4 font-semibold text-[#1F5C2E]">Ton offre est publiée</p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {qty} kg · {Number(price).toLocaleString("fr-FR")} FCFA
                </p>
                <AudioWaveIcon playing size="md" variant="recorded" className="mt-3" />
                <button
                  type="button"
                  onClick={() => {
                    setPublished(false)
                    go("payer")
                  }}
                  className="mt-6 w-full rounded-xl bg-[#C27D10] py-3 text-sm font-semibold text-white"
                >
                  Voir le parcours paiement (acheteur)
                </button>
              </div>
            )}
          </section>
        )}

        {screen === "payer" && (
          <section className="px-4 pt-4">
            <button
              type="button"
              onClick={() => go("accueil")}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#4B5563]"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <h2 className="font-serif text-2xl text-[#1F5C2E]">Paiement protégé</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Tu paies maintenant. Le vendeur touche l’argent après confirmation de livraison.
            </p>
            <div className="mt-2">
              <ExplainButton text="Tu paies maintenant. L’argent est mis en séquestre chez Feexpay. Quand tu confirmes que tu as bien reçu la marchandise, l’argent est libéré pour le vendeur." />
            </div>

            <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Progression</p>
              <ol className="mt-4 flex items-center justify-between gap-1">
                {ESCROW_STEPS.map((step, i) => {
                  const done = i <= escrowStep
                  const current = i === escrowStep
                  return (
                    <li key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                          done ? "bg-[#1F5C2E] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]",
                          current && "ring-2 ring-[#C27D10] ring-offset-2",
                        )}
                      >
                        {done && i < escrowStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          done ? "text-[#1F5C2E]" : "text-[#9CA3AF]",
                        )}
                      >
                        {step.label}
                      </span>
                    </li>
                  )
                })}
              </ol>

              <p className="mt-5 rounded-xl bg-[#F0F7F2] px-3 py-2.5 text-sm text-[#1F5C2E]">
                {escrowStep === 0 && "Prêt à payer via Feexpay CI."}
                {escrowStep === 1 && "Fonds bloqués en séquestre — le vendeur ne peut pas encore retirer."}
                {escrowStep === 2 && "Marchandise marquée livrée — en attente de ta confirmation."}
                {escrowStep === 3 && "Tu as confirmé la réception. Libération en cours…"}
                {escrowStep === 4 && "Fonds libérés au vendeur. Transaction terminée."}
              </p>

              <button
                type="button"
                onClick={() => setEscrowStep((s) => Math.min(s + 1, ESCROW_STEPS.length - 1))}
                disabled={escrowStep >= ESCROW_STEPS.length - 1}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#1F5C2E] text-sm font-semibold text-white disabled:opacity-40"
              >
                {escrowStep >= ESCROW_STEPS.length - 1 ? "Terminé" : "Étape suivante (démo)"}
              </button>
              {escrowStep > 0 && (
                <button
                  type="button"
                  onClick={() => setEscrowStep(0)}
                  className="mt-2 w-full py-2 text-xs text-[#6B7280]"
                >
                  Recommencer
                </button>
              )}
            </div>
          </section>
        )}

        {screen === "avance" && (
          <section className="px-4 pt-4">
            <button
              type="button"
              onClick={() => go("accueil")}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#4B5563]"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <h2 className="font-serif text-2xl text-[#1F5C2E]">Demander une avance</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Court. Clair. Pas de jargon bancaire.</p>
            <div className="mt-2">
              <ExplainButton text="L’avance te donne de l’argent maintenant sur une vente déjà confirmée. Tu rembourseras quand le paiement final arrivera. Ton score doit être au moins 500." />
            </div>

            <div className="mt-5 rounded-2xl border border-[#1F5C2E]/15 bg-white p-4">
              <p className="text-sm text-[#6B7280]">Ton score SCG</p>
              <p className="font-serif text-4xl text-[#1F5C2E]">540</p>
              <p className="mt-1 text-sm font-medium text-[#1F5C2E]">
                Tu es éligible — dossier suffisant pour une avance.
              </p>
              <div className="mt-3 space-y-1.5 rounded-xl bg-[#FFF8E8] px-3 py-2.5 text-sm text-[#4B5563]">
                <p className="font-medium text-[#C27D10]">Pour monter à 600 :</p>
                <p>1. Livrer 2 commandes à l’heure</p>
                <p>2. Recevoir une confirmation acheteur sans litige</p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-[#4B5563]">Montant (FCFA)</span>
              <input
                defaultValue="75000"
                className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-base"
                inputMode="numeric"
              />
            </label>

            <button
              type="button"
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#1F5C2E]/15 bg-white px-4 py-3"
            >
              <AudioWaveIcon size="sm" variant="recorded" />
              <span className="flex-1 text-left text-sm">Justification vocale (optionnel)</span>
            </button>

            <button
              type="button"
              onClick={() => speak("Ta demande d’avance a été envoyée. L’équipe GWA va l’étudier.")}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#1F5C2E] text-base font-semibold text-white"
            >
              Envoyer la demande
            </button>
          </section>
        )}

        {screen === "moi" && (
          <section className="px-4 pt-4">
            <h2 className="font-serif text-2xl text-[#1F5C2E]">Mon activité</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Produits, commandes, score, avances.</p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => go("avance")}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#E5E7EB]"
              >
                <TrendingUp className="h-5 w-5 text-[#1F5C2E]" />
                <span className="flex-1">
                  <span className="block font-medium">Score SCG · 540</span>
                  <span className="text-xs text-[#6B7280]">Coach : 2 actions pour monter</span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
              </button>

              <button
                type="button"
                onClick={() => go("payer")}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#E5E7EB]"
              >
                <Shield className="h-5 w-5 text-[#1F5C2E]" />
                <span className="flex-1">
                  <span className="block font-medium">Commandes & séquestre</span>
                  <span className="text-xs text-[#6B7280]">Voir le stepper escrow</span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
              </button>

              <a
                href={`${WHATSAPP_LINK}?text=${encodeURIComponent("Bonjour GWA, je suis producteur (démo UX). J’ai besoin d’aide sur : ")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-2xl bg-[#1F5C2E] p-4 text-left text-white shadow-sm"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="flex-1">
                  <span className="block font-medium">Parler à quelqu’un</span>
                  <span className="text-xs text-white/80">WhatsApp — template pré-rempli</span>
                </span>
              </a>
            </div>

            <p className="mt-6 text-center text-[11px] text-[#9CA3AF]">
              Démo checklist UX — branche <code className="text-[#6B7280]">cursor/ux-beta-checklist-f056</code>
            </p>
          </section>
        )}
      </div>

      <DemoNav
        screen={screen}
        onChange={(s) => {
          if (s === "moi") go("moi")
          else go("accueil")
        }}
      />
    </div>
  )
}
