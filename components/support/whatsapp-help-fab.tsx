"use client"

import { MessageCircle } from "lucide-react"
import { WHATSAPP_LINK } from "@/lib/contact"
import { cn } from "@/lib/utils"

export function WhatsAppHelpFab({
  context = "aide",
  className,
}: {
  context?: string
  className?: string
}) {
  const text = encodeURIComponent(
    `Bonjour GWA, j’ai besoin d’aide (${context}). Mon problème : `,
  )
  return (
    <a
      href={`${WHATSAPP_LINK}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#1F5C2E] px-4 py-2.5 text-sm font-medium text-white shadow-lg active:scale-95",
        className,
      )}
      aria-label="Parler à quelqu’un sur WhatsApp"
    >
      <MessageCircle className="h-4 w-4" />
      Parler à quelqu’un
    </a>
  )
}
