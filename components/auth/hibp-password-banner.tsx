"use client"

import { useEffect, useState } from "react"
import { Shield } from "lucide-react"
import {
  HIBP_BANNER_MESSAGE,
  HIBP_DISMISS_COOKIE,
  shouldShowHibpBanner,
} from "@/lib/auth/hibp-banner"

function readDismissed(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${HIBP_DISMISS_COOKIE}=1`))
}

function writeDismissed() {
  const maxAge = 60 * 60 * 24 * 30
  document.cookie = `${HIBP_DISMISS_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`
}

/** Bannière login/signup — campagne sécurité mots de passe (1 semaine). */
export function HibpPasswordBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(shouldShowHibpBanner(new Date(), readDismissed()))
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-[var(--gwa-gold)]/40 bg-[var(--gwa-gold-soft,#FFF8E8)] px-3 py-3 text-sm text-[#111827]"
    >
      <div className="flex gap-2 items-start">
        <Shield className="h-4 w-4 mt-0.5 shrink-0 text-[var(--gwa-primary,#1F5C2E)]" aria-hidden />
        <p className="flex-1 leading-snug">{HIBP_BANNER_MESSAGE}</p>
        <button
          type="button"
          className="text-xs text-neutral-500 underline shrink-0"
          onClick={() => {
            writeDismissed()
            setVisible(false)
          }}
        >
          OK
        </button>
      </div>
    </div>
  )
}
