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

/**
 * Parcours vocal séquentiel.
 * Important : démarrer le son dans le même geste utilisateur (autoplay policies).
 */
export function useShopVoiceTour(products: ShopTourProduct[]) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stoppedRef = useRef(false)
  const productsRef = useRef(products)
  productsRef.current = products

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.currentTime = 0
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setActive(false)
    setIndex(0)
  }, [])

  const speakProduct = useCallback(
    (product: ShopTourProduct, onDone: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        onDone()
        return
      }
      const text = buildProductListenText(product)
      if (!text.trim()) {
        onDone()
        return
      }

      // Ne pas cancel juste avant speak (bug Chrome : speak ignoré)
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = resolveUtterLang(product.audio_lang)
      utter.rate = 0.92
      utter.volume = 1

      const voices = window.speechSynthesis.getVoices()
      if (voices.length) {
        const lang = utter.lang.slice(0, 2).toLowerCase()
        const match =
          voices.find((v) => v.lang?.toLowerCase().startsWith(lang)) ||
          voices.find((v) => v.default) ||
          voices[0]
        if (match) utter.voice = match
      }

      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        onDone()
      }
      utter.onend = finish
      utter.onerror = () => finish()

      // File d'attente TTS dans le geste utilisateur
      window.speechSynthesis.speak(utter)

      // Si les voix arrivent tard (iOS/Chrome), relancer une fois
      if (!voices.length) {
        const retry = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", retry)
          if (settled || stoppedRef.current) return
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return
          const late = window.speechSynthesis.getVoices()
          if (!late.length) return
          const again = new SpeechSynthesisUtterance(text)
          again.lang = utter.lang
          again.rate = utter.rate
          again.volume = 1
          const lang = again.lang.slice(0, 2).toLowerCase()
          const match =
            late.find((v) => v.lang?.toLowerCase().startsWith(lang)) ||
            late.find((v) => v.default) ||
            late[0]
          if (match) again.voice = match
          again.onend = finish
          again.onerror = () => finish()
          window.speechSynthesis.speak(again)
        }
        window.speechSynthesis.addEventListener("voiceschanged", retry)
        window.setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", retry)
        }, 1500)
      }
    },
    [],
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
        playAt(i + 1)
      }

      if (product.audio_url) {
        if (!audioRef.current) audioRef.current = new Audio()
        const el = audioRef.current
        el.pause()
        el.src = product.audio_url
        el.onended = continueNext
        el.onerror = () => speakProduct(product, continueNext)
        void el.play().then(undefined, () => {
          speakProduct(product, continueNext)
        })
        return
      }

      speakProduct(product, continueNext)
    },
    [speakProduct, stop],
  )

  const startTour = useCallback(() => {
    const list = productsRef.current
    if (!list.length || typeof window === "undefined") return
    if (active) {
      stop()
      return
    }

    stoppedRef.current = false
    setActive(true)
    setIndex(0)

    try {
      localStorage.setItem("gwa-listen-mode", "1")
    } catch {
      /* ignore */
    }

    // iOS / Chrome : réveiller AudioContext dans le geste
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
        osc.stop(ctx.currentTime + 0.02)
      }
    } catch {
      /* ignore */
    }

    // Déblocage sur un Audio SÉPARÉ — ne jamais pause() le player du tour
    // (sinon audio_url démarré juste après est coupé par le .then du silent unlock)
    const silentUrl = makeSilentBlobUrl()
    if (silentUrl) {
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

    // Précharger les voix TTS si besoin
    try {
      window.speechSynthesis?.getVoices()
    } catch {
      /* ignore */
    }

    // Lancer le 1er produit tout de suite (même tick que le clic)
    playAt(0)
  }, [active, playAt, stop])

  const toggle = useCallback(() => {
    if (!productsRef.current.length || typeof window === "undefined") return
    startTour()
  }, [startTour])

  useEffect(() => () => stop(), [stop])

  return {
    active,
    index,
    total: products.length,
    start: toggle,
    startTour,
    stop,
  }
}
