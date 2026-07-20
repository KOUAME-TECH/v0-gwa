"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { buildProductListenText, type ProductListenInput } from "@/lib/media/product-listen"

export type ShopTourProduct = ProductListenInput & {
  id: string
  audio_url?: string | null
}

/** Parcours vocal séquentiel — lit les produits filtrés (inclusion + rétention). */
export function useShopVoiceTour(products: ShopTourProduct[]) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stoppedRef = useRef(false)

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setActive(false)
    setIndex(0)
  }, [])

  const playAt = useCallback(
    (i: number) => {
      if (stoppedRef.current || i >= products.length) {
        stop()
        return
      }

      setIndex(i)
      const product = products[i]

      const continueNext = () => {
        if (stoppedRef.current) return
        playAt(i + 1)
      }

      if (product.audio_url) {
        if (!audioRef.current) audioRef.current = new Audio()
        audioRef.current.src = product.audio_url
        audioRef.current.onended = continueNext
        audioRef.current.onerror = continueNext
        audioRef.current.play().catch(continueNext)
        return
      }

      if (typeof window === "undefined" || !window.speechSynthesis) {
        continueNext()
        return
      }

      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(buildProductListenText(product))
      utter.lang = "fr-FR"
      utter.rate = 0.92
      utter.onend = continueNext
      utter.onerror = continueNext
      window.speechSynthesis.speak(utter)
    },
    [products, stop],
  )

  const start = useCallback(() => {
    if (!products.length || typeof window === "undefined") return
    if (active) {
      stop()
      return
    }
    stoppedRef.current = false
    setActive(true)
    playAt(0)
  }, [active, playAt, products.length, stop])

  useEffect(() => () => stop(), [stop])

  return {
    active,
    index,
    total: products.length,
    start,
    stop,
  }
}
