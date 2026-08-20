"use client"

import Link from "next/link"
import { ChevronRight, Square } from "lucide-react"
import { useState } from "react"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { buildCoachSpeech, coachIntro, type CoachAction } from "@/lib/scg/coach"
import { cn } from "@/lib/utils"

export function ScgCoachPanel({
  score,
  actions,
  className,
}: {
  score: number
  actions: CoachAction[]
  className?: string
}) {
  const [playing, setPlaying] = useState(false)

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    if (playing) {
      window.speechSynthesis.cancel()
      setPlaying(false)
      return
    }
    const u = new SpeechSynthesisUtterance(buildCoachSpeech(score, actions))
    u.lang = "fr-FR"
    u.rate = 0.92
    u.onend = () => setPlaying(false)
    u.onerror = () => setPlaying(false)
    setPlaying(true)
    window.speechSynthesis.speak(u)
  }

  if (!actions.length) return null

  return (
    <div className={cn("rounded-2xl border border-[#1F5C2E]/15 bg-[#F0F7F2] p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#1F5C2E] text-sm">Comment bien vendre</p>
          <p className="text-xs text-[#4B5563] mt-0.5">
            {coachIntro(score)}
          </p>
        </div>
        <button
          type="button"
          onClick={speak}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium shrink-0",
            playing ? "bg-[#C27D10]/15 text-[#C27D10]" : "bg-white text-[#1F5C2E]",
          )}
          aria-label={playing ? "Arrêter" : "Écouter le coach"}
        >
          {playing ? <Square className="h-3 w-3 fill-current" /> : <AudioWaveIcon size="xs" variant="synth" />}
          {playing ? "…" : "Écouter"}
        </button>
      </div>
      <ul className="space-y-2">
        {actions.map((a, i) => (
          <li key={a.dim}>
            <Link
              href={a.href}
              className="flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2.5 hover:bg-white transition-colors"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1F5C2E] text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[#111827]">{a.title}</span>
                <span className="block text-xs text-[#6B7280] mt-0.5">{a.how}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-[#9CA3AF] mt-1 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
