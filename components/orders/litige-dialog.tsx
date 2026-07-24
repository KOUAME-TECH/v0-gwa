"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DISPUTE_REASONS, type DisputeReasonId } from "@/lib/orders/escrow-flow"
import { toast } from "sonner"

type Props = {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function LitigeDialog({ orderId, open, onOpenChange, onSuccess }: Props) {
  const [reason, setReason] = useState<DisputeReasonId>("quality_issue")
  const [description, setDescription] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setReason("quality_issue")
    setDescription("")
    setPhotoUrl("")
  }

  const submit = async () => {
    if (!orderId) return
    if (!description.trim()) {
      toast.error("Décris le problème")
      return
    }
    setSubmitting(true)
    try {
      const photos = photoUrl.trim()
        ? [{ type: "image", url: photoUrl.trim() }]
        : null
      const res = await fetch(`/api/orders/${orderId}/litige`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          reason,
          photos,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Litige impossible")
        return
      }
      toast.success("Litige ouvert. Les fonds sont gelés.")
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ouvrir un litige</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motif</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as DisputeReasonId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique clairement le problème…"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Preuve (URL image, optionnel)</Label>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Envoi…" : "Ouvrir le litige"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
