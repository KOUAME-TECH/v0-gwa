"use client"

import React from "react"
import Link from "next/link"

type Props = { children: React.ReactNode }

type State = { hasError: boolean; message?: string }

/**
 * Filet de sécurité UI — l'app ne reste jamais sur un écran blanc.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message }
  }

  componentDidCatch(error: Error) {
    console.error("[AppErrorBoundary]", error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-[#1F5C2E]">GWA a rencontré un souci</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Pas de panique — vos données sont en sécurité. Rechargez ou revenez à l&apos;accueil.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-[#1F5C2E] px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              this.setState({ hasError: false, message: undefined })
              if (typeof window !== "undefined") window.location.reload()
            }}
          >
            Recharger
          </button>
          <Link
            href="/"
            className="rounded-xl border border-[#1F5C2E]/30 px-4 py-2 text-sm font-medium text-[#1F5C2E]"
            onClick={() => this.setState({ hasError: false })}
          >
            Accueil
          </Link>
        </div>
      </div>
    )
  }
}
