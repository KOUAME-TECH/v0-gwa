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

/** Pause entre deux produits (ms) — assez longue pour comprendre */
const GAP_MS = 1_100
/** Débit TTS plus lent pour Afrique / bruits ambiants */
const TTS_RATE = 0.82
/** Temps mini d'écoute par produit même si TTS échoue (ms) */
const MIN_DWELL_MS = 3_500

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
      osc.stop(ctx.currentTime + 0.05)
      window.setTimeout(() => {
        void ctx.close().catch(() => {
          /* ignore */
        })
      }, 300)
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

function estimateSpeakMs(text: string, rate: number): number {
  // ~12 caractères / seconde à rate 1
  const chars = Math.max(text.length, 24)
  return Math.max(MIN_DWELL_MS, Math.round((chars / 12) * 1000 * (1 / rate)))
}

/**
 * Parcours / Digest vocal — rythme lent, TTS fiable, pas de course.
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
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  productsRef.current = products

  const clearTimers = useCallback(() => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    if (gapTimerRef.current) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
  }, [])

  const startResumeKeepalive = useCallback(() => {
    if (resumeTimerRef.current) clearInterval(resumeTimerRef.current)
    resumeTimerRef.current = setInterval(() => {
      if (stoppedRef.current) return
      try {
        if (window.speechSynthesis?.paused) {
          window.speechSynthesis.resume()
        } else if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.resume()
        }
      } catch {
        /* ignore */
      }
    }, 5_000)
  }, [])

  const stop = useCallback(() => {
    stoppedRef.current = true
    activeRef.current = false
    clearTimers()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.removeAttribute("src")
      try {
        audioRef.current.load()
      } catch {
        /* ignore */
      }
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
  }, [clearTimers])

  const speakProduct = useCallback(
    (product: ShopTourProduct, onDone: () => void) => {
      if (typeof window === "undefined") {
        onDone()
        return
      }
      if (!window.speechSynthesis) {
        setError("Lecture vocale indisponible sur cet appareil")
        // Dwell minimum même sans TTS
        dwellTimerRef.current = setTimeout(onDone, MIN_DWELL_MS)
        return
      }

      const text = buildProductListenText(product)
      if (!text.trim()) {
        onDone()
        return
      }

      let lang = resolveUtterLang(product.audio_lang)
      let voice = pickVoice(lang)
      if (!voice || !voice.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) {
        lang = "fr-FR"
        voice = pickVoice("fr-FR")
      }

      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.rate = TTS_RATE
      utter.pitch = 1
      utter.volume = 1
      if (voice) utter.voice = voice

      let settled = false
      const startedAt = Date.now()
      const minMs = estimateSpeakMs(text, TTS_RATE)

      const finish = (force = false) => {
        if (settled) return
        const elapsed = Date.now() - startedAt
        if (!force && elapsed < minMs && !stoppedRef.current) {
          // Attendre la fin du dwell pour que l'oreille suive
          dwellTimerRef.current = setTimeout(() => finish(true), minMs - elapsed)
          return
        }
        settled = true
        onDone()
      }

      utter.onstart = () => {
        startResumeKeepalive()
      }
      utter.onend = () => finish()
      utter.onerror = (ev) => {
        const errType = (ev as SpeechSynthesisErrorEvent).error
        if (stoppedRef.current) {
          finish(true)
          return
        }
        // interrupted/canceled pendant un speak volontaire → ignorer si on parle encore
        if (errType === "interrupted" || errType === "canceled") {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            return
          }
          // Sinon attendre le dwell puis continuer (évite la course)
          finish()
          return
        }
        console.warn("[shop-voice-tour] TTS error", errType)
        setError("Son coupé. Vérifiez le volume et réessayez.")
        finish()
      }

      try {
        window.speechSynthesis.resume()
      } catch {
        /* ignore */
      }
      window.speechSynthesis.speak(utter)
      startResumeKeepalive()

      // Filet de sécurité : si onend ne fire jamais, avancer après estimation
      dwellTimerRef.current = setTimeout(() => {
        if (!settled && !stoppedRef.current) {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            finish(true)
          }
        }
      }, minMs + 2_000)

      if (!window.speechSynthesis.getVoices().length) {
        const retry = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", retry)
          if (settled || stoppedRef.current) return
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return
          const lateVoice = pickVoice(lang) || pickVoice("fr-FR")
          const again = new SpeechSynthesisUtterance(text)
          again.lang = lateVoice?.lang || "fr-FR"
          again.rate = TTS_RATE
          again.volume = 1
          if (lateVoice) again.voice = lateVoice
          again.onend = () => finish()
          again.onerror = () => finish()
          window.speechSynthesis.speak(again)
        }
        window.speechSynthesis.addEventListener("voiceschanged", retry)
        window.setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", retry)
        }, 2500)
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
        gapTimerRef.current = setTimeout(() => {
          if (!stoppedRef.current) playAt(i + 1)
        }, GAP_MS)
      }

      if (product.audio_url) {
        if (!audioRef.current) audioRef.current = new Audio()
        const el = audioRef.current
        el.pause()
        el.src = product.audio_url
        let settled = false
        const finishAudio = () => {
          if (settled || stoppedRef.current) return
          settled = true
          continueNext()
        }
        el.onended = () => {
          // Audio très court → laisser un mini silence pour l'oreille
          const playedMs = Math.max(0, (el.currentTime || 0) * 1000)
          const wait = Math.max(0, Math.min(MIN_DWELL_MS - playedMs, MIN_DWELL_MS))
          if (wait > 200) {
            dwellTimerRef.current = setTimeout(finishAudio, wait)
          } else {
            finishAudio()
          }
        }
        el.onerror = () => {
          if (settled) return
          settled = true
          speakProduct(product, continueNext)
        }
        void el.play().then(
          () => {
            /* ok */
          },
          () => {
            if (settled) return
            settled = true
            speakProduct(product, continueNext)
          },
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

    if (activeRef.current) {
      stop()
      return false
    }

    stoppedRef.current = false
    activeRef.current = true
    setError(null)
    setActive(true)
    setIndex(0)

    try {
      localStorage.setItem("gwa-listen-mode", "1")
    } catch {
      /* ignore */
    }

    unlockAudioGesture()

    // Précharger les voix SANS cancel (cancel tue le 1er speak)
    try {
      window.speechSynthesis?.getVoices()
      window.speechSynthesis?.resume()
    } catch {
      /* ignore */
    }

    // Lancer dans le geste utilisateur (léger délai pour laisser unlock finir)
    window.setTimeout(() => {
      if (!stoppedRef.current) playAt(0)
    }, 60)
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
    start: toggle,
    startTour: start,
    stop,
    currentProductId: active ? products[index]?.id ?? null : null,
  }
}
