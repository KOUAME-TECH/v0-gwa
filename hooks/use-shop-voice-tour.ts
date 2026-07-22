"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { buildProductListenText, type ProductListenInput } from "@/lib/media/product-listen"
import { resolveUtterLang } from "@/lib/media/audio-langs"

export type ShopTourProduct = ProductListenInput & {
  id: string
  audio_url?: string | null
  audio_lang?: string | null
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

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
    if (!productsRef.current.length || typeof window === "undefined") return
    if (active) {
      stop()
      return
    }

    stoppedRef.current = false
    setActive(true)
    setIndex(0)

    // Mode écoute pour le reste de l’UI
    try {
      localStorage.setItem("gwa-listen-mode", "1")
    } catch {
      /* ignore */
    }

    // Déblocage audio SYNCHRONE dans le geste clic (puis enchaîner)
    if (!audioRef.current) audioRef.current = new Audio()
    const unlock = audioRef.current
    unlock.src = SILENT_WAV
    unlock.volume = 0.01

    const begin = () => {
      if (stoppedRef.current) return
      unlock.volume = 1
      // Premier produit tout de suite
      playAt(0)
    }

    try {
      const p = unlock.play()
      if (p && typeof p.then === "function") {
        void p
          .then(() => {
            unlock.pause()
            unlock.currentTime = 0
            begin()
          })
          .catch(() => begin())
      } else {
        begin()
      }
    } catch {
      begin()
    }
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
