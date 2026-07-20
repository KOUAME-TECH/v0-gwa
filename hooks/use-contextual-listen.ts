"use client"

import { useEffect, useRef } from "react"

/** Écoute contextuelle — lit automatiquement le contenu visible (mode écoute). */
export function useAutoListenOnView(
  enabled: boolean,
  canListen: boolean,
  onListen: () => void,
  playing: boolean,
) {
  const ref = useRef<HTMLDivElement>(null)
  const playedRef = useRef(false)

  useEffect(() => {
    playedRef.current = false
  }, [enabled, canListen])

  useEffect(() => {
    if (!enabled || !canListen || playedRef.current || playing || !ref.current) return

    const node = ref.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.55 && !playedRef.current) {
          playedRef.current = true
          onListen()
        }
      },
      { threshold: [0.55, 0.75] },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, canListen, onListen, playing])

  return ref
}
