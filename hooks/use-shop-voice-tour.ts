"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { buildProductListenText, type ProductListenInput } from "@/lib/media/product-listen"
import { resolveUtterLang } from "@/lib/media/audio-langs"

export type ShopTourProduct = ProductListenInput & {
  id: string
  audio_url?: string | null
  audio_lang?: string | null
}

const SILENT_WAV_B64 =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

function makeSilentBlobUrl(): string | null {
  try {
    const bin = atob(SILENT_WAV_B64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }))
  } catch {
    return null
  }
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const wanted = lang.toLowerCase()
  const prefix = wanted.slice(0, 2)
  return (
    voices.find((v) => v.lang?.toLowerCase() === wanted) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ||
    // Langues locales sans voix appareil → français
    voices.find((v) => v.lang?.toLowerCase().startsWith("fr")) ||
    voices.find((v) => v.default) ||
    voices[0] ||
    null
  )
}

function unlockAudioGesture() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (AC) {
      const ctx = new AC()
      void ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.03)
      window.setTimeout(() => {
        void ctx.close().catch(() => {
          /* ignore */
        })
      }, 200)
    }
  } catch {
    /* ignore */
  }

  const silentUrl = makeSilentBlobUrl()
  if (!silentUrl) return
  try {
    const unlock = new Audio(silentUrl)
    unlock.volume = 0.01
    void unlock.play().then(
      () => {
        unlock.pause()
        URL.revokeObjectURL(silentUrl)
      },
      () => URL.revokeObjectURL(silentUrl),
    )
  } catch {
    URL.revokeObjectURL(silentUrl)
  }
}

/**
 * Parcours / Digest vocal.
 * Démarre dans le geste utilisateur + keepalive Chrome speechSynthesis.
 */
export function useShopVoiceTour(products: ShopTourProduct[]) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stoppedRef = useRef(true)
  const activeRef = useRef(false)
  const productsRef = useRef(products)
  const resumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playedCountRef = useRef(0)
  productsRef.current = products

  const clearResumeKeepalive = useCallback(() => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }, [])

  const startResumeKeepalive = useCallback(() => {
    clearResumeKeepalive()
    // Chrome coupe TTS après ~15s sans resume()
    resumeTimerRef.current = setInterval(() => {
      if (stoppedRef.current) return
      try {
        if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.resume()
        }
      } catch {
        /* ignore */
      }
    }, 8_000)
  }, [clearResumeKeepalive])

  const stop = useCallback(() => {
    stoppedRef.current = true
    activeRef.current = false
    clearResumeKeepalive()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.removeAttribute("src")
      audioRef.current.load()
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
    }
    setActive(false)
    setIndex(0)
  }, [clearResumeKeepalive])

  const speakProduct = useCallback(
    (product: ShopTourProduct, onDone: () => void) => {
      if (typeof window === "undefined") {
        onDone()
        return
      }
      if (!window.speechSynthesis) {
        setError("Lecture vocale indisponible sur cet appareil")
        onDone()
        return
      }

      const text = buildProductListenText(product)
      if (!text.trim()) {
        onDone()
        return
      }

      // Langue demandée, sinon fr-FR (voix fiables)
      let lang = resolveUtterLang(product.audio_lang)
      let voice = pickVoice(lang)
      if (!voice || !voice.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) {
        // Pas de voix pour wolof/bambara/etc. → français lisible
        lang = "fr-FR"
        voice = pickVoice("fr-FR")
      }

      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.rate = 0.95
      utter.volume = 1
      if (voice) utter.voice = voice

      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        onDone()
      }

      utter.onend = () => {
        playedCountRef.current += 1
        finish()
      }
      utter.onerror = (ev) => {
        // interrupted = stop volontaire ou nouveau speak — ne pas enchaîner en double
        const errType = (ev as SpeechSynthesisErrorEvent).error
        if (errType === "interrupted" || errType === "canceled" || stoppedRef.current) {
          finish()
          return
        }
        console.warn("[shop-voice-tour] TTS error", errType)
        setError("Son coupé. Réessayez avec le volume activé.")
        finish()
      }

      try {
        // Relancer si Chrome a mis TTS en pause
        window.speechSynthesis.resume()
      } catch {
        /* ignore */
      }
      window.speechSynthesis.speak(utter)
      startResumeKeepalive()

      // Voix chargées en retard (Safari/Chrome)
      if (!window.speechSynthesis.getVoices().length) {
        const retry = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", retry)
          if (settled || stoppedRef.current) return
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return
          const lateVoice = pickVoice(lang) || pickVoice("fr-FR")
          const again = new SpeechSynthesisUtterance(text)
          again.lang = lateVoice?.lang || "fr-FR"
          again.rate = 0.95
          again.volume = 1
          if (lateVoice) again.voice = lateVoice
          again.onend = () => {
            playedCountRef.current += 1
            finish()
          }
          again.onerror = () => finish()
          window.speechSynthesis.speak(again)
        }
        window.speechSynthesis.addEventListener("voiceschanged", retry)
        window.setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", retry)
        }, 2000)
      }
    },
    [startResumeKeepalive],
  )

  const playAt = useCallback(
    (i: number) => {
      const list = productsRef.current
      if (stoppedRef.current || i >= list.length) {
        stop()
        return
      }

      setIndex(i)
      const product = list[i]

      const continueNext = () => {
        if (stoppedRef.current) return
        // Petite pause naturelle entre produits
        window.setTimeout(() => {
          if (!stoppedRef.current) playAt(i + 1)
        }, 280)
      }

      if (product.audio_url) {
        if (!audioRef.current) audioRef.current = new Audio()
        const el = audioRef.current
        el.pause()
        el.src = product.audio_url
        el.onended = () => {
          playedCountRef.current += 1
          continueNext()
        }
        el.onerror = () => speakProduct(product, continueNext)
        void el.play().then(
          () => {
            /* ok */
          },
          () => speakProduct(product, continueNext),
        )
        return
      }

      speakProduct(product, continueNext)
    },
    [speakProduct, stop],
  )

  const start = useCallback(() => {
    const list = productsRef.current
    if (!list.length || typeof window === "undefined") {
      setError("Aucun produit à lire")
      return false
    }

    // Toggle stop si déjà actif
    if (activeRef.current) {
      stop()
      return false
    }

    stoppedRef.current = false
    activeRef.current = true
    playedCountRef.current = 0
    setError(null)
    setActive(true)
    setIndex(0)

    try {
      localStorage.setItem("gwa-listen-mode", "1")
    } catch {
      /* ignore */
    }

    unlockAudioGesture()

    try {
      window.speechSynthesis?.getVoices()
      window.speechSynthesis?.cancel()
      window.speechSynthesis?.resume()
    } catch {
      /* ignore */
    }

    // Lancer immédiatement dans le geste utilisateur
    playAt(0)
    return true
  }, [playAt, stop])

  const toggle = useCallback(() => {
    if (activeRef.current) {
      stop()
      return
    }
    start()
  }, [start, stop])

  useEffect(() => () => stop(), [stop])

  return {
    active,
    index,
    total: products.length,
    error,
    /** Démarre ou arrête */
    start: toggle,
    /** Démarre forcément (ne toggle pas) */
    startTour: start,
    stop,
    currentProductId: active ? products[index]?.id ?? null : null,
  }
}
