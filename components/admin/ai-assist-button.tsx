"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import type { AdminAiTask } from "@/lib/admin/ai-entitlements"
import { ADMIN_AI_TEMPLATES } from "@/lib/admin/ai-templates"
import { cn } from "@/lib/utils"

/**
 * Bouton inline « Yelly Ops » — remplit un brouillon via callback.
 */
export function AdminAiAssistButton({
  task,
  context,
  message,
  onDraft,
  className,
  label = "Yelly Ops",
}: {
  task: AdminAiTask
  context: string
  message?: string
  onDraft: (draft: string) => void
  className?: string
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  async function run() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          context,
          message: message || ADMIN_AI_TEMPLATES[task].defaultMessage,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "IA indisponible")
        return
      }
      onDraft(String(data.reply || ""))
      if (typeof data.aiRemaining === "number") {
        toast.success(`Brouillon prêt · ${data.aiRemaining} IA restantes`)
      } else {
        toast.success("Brouillon Yelly Ops prêt")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => void run()}
      className={cn("gap-1.5 border-[#C27D10]/40 text-[#C27D10]", className)}
    >
      <Sparkles className={`h-3.5 w-3.5 ${busy ? "animate-pulse" : ""}`} />
      {busy ? "Yelly…" : label}
    </Button>
  )
}
