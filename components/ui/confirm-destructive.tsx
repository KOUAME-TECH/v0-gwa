"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

/** Confirmation destructive uniforme (admin / actions sensibles). */
export function ConfirmDestructive({
  triggerLabel,
  title,
  description,
  confirmLabel = "Confirmer",
  onConfirm,
  disabled,
  triggerVariant = "destructive",
  triggerSize = "sm",
}: {
  triggerLabel: string
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  triggerVariant?: "destructive" | "outline" | "secondary"
  triggerSize?: "sm" | "default" | "lg" | "icon"
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} disabled={disabled}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
