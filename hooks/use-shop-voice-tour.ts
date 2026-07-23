"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { buildProductListenText, type ProductListenInput } from "@/lib/media/product-listen"
import { resolveUtterLang } from "@/lib/media/audio-langs"
import { setShopTourActive } from "@/lib/media/shop-tour-lock"

export type ShopTourProduct = ProductListenInput & {
  id: string
  audio_url?: string | null
  audio_lang?: string | null
}

const SILENT_WAV_B64 =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

/** Silence entre deux produits (laisse digérer) */
const GAP_MS = 1_400
/** Débit proche d'une voix humaine (trop lent = robot) */
const TTS_RATE = 0.94
const TTS_PITCH = 1.04
/** Garde-fou si onend ne fire jamais */
const SAFETY_PAD_MS = 4_000

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

/** Préfère les voix naturelles (Google / Microsoft / Apple) en français. */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const wanted = lang.toLowerCase()
  const prefix = wanted.slice(0, 2)
  const pool = voices.filter(
    (v) =>
      v.lang?.toLowerCase() === wanted ||
      v.lang?.toLowerCase().startsWith(prefix),
  )
  const frPool =
    pool.length > 0
      ? pool
      : voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"))

  const score = (v: SpeechSynthesisVoice) => {
    const n = `${v.name} ${v.voiceURI}`.toLowerCase()
    let s = 0
    if (n.includes("google")) s += 50
    if (n.includes("microsoft") || n.includes("natural")) s += 40
    if (n.includes("enhanced") || n.includes("premium")) s += 30
    if (n.includes("thomas") || n.includes("marie") || n.includes("amélie") || n.includes("amelie"))
      s += 25
    if (n.includes("virginie") || n.includes("denise") || n.includes("hortense")) s += 20
    if (n.includes("compact") || n.includes("eloquence")) s -= 20
    if (v.localService === false) s += 10
    if (v.default) s += 5
    return s
  }

  const ranked = [...(frPool.length ? frPool : voices)].sort((a, b) => score(b) - score(a))
  return ranked[0] || null
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
  // ~14 car/s à rate 1 pour du FR parlé
  const chars = Math.max(text.length, 40)
  return Math.round((chars / 14) * 1000 * (1 / rate)) + 800
}

/**
 * Parcours / Digest vocal — voix fluide, lit TOUS les produits sans sauter.
 */
export function useShopVoiceTour(products: ShopTourProduct[]) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  const stoppedRef = useRef(true)
  const activeRef = useRef(false)
  /** Snapshot figé au start — évite reshuffle mid-tour */
  const tourListRef = useRef<ShopTourProduct[]>([])
  const productsRef = useRef(products)
  const resumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
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
        // Uniquement si paused (resume pendant speaking peut couper certains WebViews)
        if (window.speechSynthesis?.paused) {
          window.speechSynthesis.resume()
        }
      } catch {
        /* ignore */
      }
    }, 8_000)
  }, [])

  const stop = useCallback(() => {
    stoppedRef.current = true
    activeRef.current = false
    setShopTourActive(false)
    clearTimers()
    utterRef.current = null
    retryCountRef.current = 0
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
        setError("La lecture vocale n'est pas dispo sur cet appareil.")
        dwellTimerRef.current = setTimeout(onDone, 2_000)
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

      const scheduleDwell = (fn: () => void, ms: number) => {
        if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current)
        dwellTimerRef.current = setTimeout(fn, ms)
      }

      const speakOnce = (attempt: number) => {
        if (stoppedRef.current) return

        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = voice?.lang || lang
        utter.rate = TTS_RATE
        utter.pitch = TTS_PITCH
        utter.volume = 1
        if (voice) utter.voice = voice
        utterRef.current = utter

        let settled = false
        const minMs = estimateSpeakMs(text, TTS_RATE)
        const startedAt = Date.now()

        const finishOk = () => {
          if (settled || stoppedRef.current) return
          settled = true
          if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current)
          utterRef.current = null
          retryCountRef.current = 0
          onDone()
        }

        utter.onstart = () => {
          startResumeKeepalive()
        }

        utter.onend = () => {
          const elapsed = Date.now() - startedAt
          // Si coupé trop tôt (< 40% du texte estimé), retenter plutôt que sauter
          if (elapsed < minMs * 0.35 && attempt < 2 && !stoppedRef.current) {
            scheduleDwell(() => speakOnce(attempt + 1), 200)
            return
          }
          finishOk()
        }

        utter.onerror = (ev) => {
          const errType = (ev as SpeechSynthesisErrorEvent).error
          if (stoppedRef.current) {
            settled = true
            return
          }
          // cancel externe (remount mic) → REJOUER, ne pas passer au suivant
          if (errType === "interrupted" || errType === "canceled") {
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              return
            }
            if (attempt < 3) {
              scheduleDwell(() => speakOnce(attempt + 1), 280)
              return
            }
            // Après 3 essais, continuer pour ne pas bloquer le parcours
            finishOk()
            return
          }
          console.warn("[shop-voice-tour] TTS error", errType)
          if (attempt < 2) {
            scheduleDwell(() => speakOnce(attempt + 1), 400)
            return
          }
          setError("On a du mal à lire ce produit. On passe au suivant.")
          finishOk()
        }

        try {
          window.speechSynthesis.resume()
        } catch {
          /* ignore */
        }

        // Ne PAS cancel avant speak — tue la file et cause interrupted
        window.speechSynthesis.speak(utter)
        startResumeKeepalive()

        scheduleDwell(() => {
          if (settled || stoppedRef.current) return
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            // encore en cours — prolonger
            scheduleDwell(() => {
              if (!settled && !stoppedRef.current) {
                if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                  finishOk()
                }
              }
            }, SAFETY_PAD_MS)
            return
          }
          // Rien ne parle → retenter ou finir
          if (attempt < 2) {
            speakOnce(attempt + 1)
          } else {
            finishOk()
          }
        }, minMs + SAFETY_PAD_MS)
      }

      // Attendre les voix si besoin
      if (!window.speechSynthesis.getVoices().length) {
        const onVoices = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoices)
          voice = pickVoice(lang) || pickVoice("fr-FR")
          if (!stoppedRef.current) speakOnce(0)
        }
        window.speechSynthesis.addEventListener("voiceschanged", onVoices)
        window.setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoices)
          if (!stoppedRef.current && !utterRef.current) speakOnce(0)
        }, 600)
        return
      }

      speakOnce(0)
    },
    [startResumeKeepalive],
  )

  const playAt = useCallback(
    (i: number) => {
      const list = tourListRef.current
      if (stoppedRef.current || i >= list.length) {
        stop()
        return
      }

      setIndex(i)
      const product = list[i]

      const continueNext = () => {
        if (stoppedRef.current) return
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
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
        el.onended = finishAudio
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
      setError("Aucun produit à écouter pour le moment.")
      return false
    }

    if (activeRef.current) {
      stop()
      return false
    }

    // Snapshot figé
    tourListRef.current = list.map((p) => ({ ...p }))
    stoppedRef.current = false
    activeRef.current = true
    setShopTourActive(true)
    setError(null)
    setActive(true)
    setIndex(0)
    retryCountRef.current = 0

    try {
      localStorage.setItem("gwa-listen-mode", "1")
    } catch {
      /* ignore */
    }

    unlockAudioGesture()

    try {
      window.speechSynthesis?.getVoices()
      window.speechSynthesis?.resume()
    } catch {
      /* ignore */
    }

    window.setTimeout(() => {
      if (!stoppedRef.current) playAt(0)
    }, 120)
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
    total: active ? tourListRef.current.length || products.length : products.length,
    error,
    start: toggle,
    startTour: start,
    stop,
    currentProductId: active ? tourListRef.current[index]?.id ?? products[index]?.id ?? null : null,
  }
}
