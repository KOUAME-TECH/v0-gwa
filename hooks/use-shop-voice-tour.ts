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
      // Ne pas cancel juste avant speak (bug Chrome : speak ignoré)
      const utter = new SpeechSynthesisUtterance(buildProductListenText(product))
      utter.lang = resolveUtterLang(product.audio_lang)
      utter.rate = 0.92
      utter.volume = 1
      utter.onend = onDone
      utter.onerror = () => onDone()
      window.speechSynthesis.speak(utter)
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

    // Déblocage audio via blob: (CSP media-src autorise blob, pas data:)
    if (!audioRef.current) audioRef.current = new Audio()
    const unlock = audioRef.current
    const silentUrl = makeSilentBlobUrl()
    try {
      if (silentUrl) {
        unlock.src = silentUrl
        unlock.volume = 0.01
        void unlock.play().then(
          () => {
            unlock.pause()
            unlock.currentTime = 0
            unlock.volume = 1
            URL.revokeObjectURL(silentUrl)
          },
          () => {
            URL.revokeObjectURL(silentUrl)
          },
        )
      }
    } catch {
      if (silentUrl) URL.revokeObjectURL(silentUrl)
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
