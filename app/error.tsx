"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-5">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Quelque chose a bloqué</h1>
        <p className="text-neutral-500 text-sm mb-6">
          La page n&apos;a pas pu s&apos;afficher. Tu peux réessayer.
        </p>
        <Button className="rounded-full px-8" onClick={() => reset()}>
          Réessayer
        </Button>
      </div>
    </div>
  )
}
