"use client"

import React from "react"
import { Mic, Send, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { validateAudioFile } from "@/lib/media/compress"

export type CommentComposerProps = {
  userInitial?: string
  value: string
  onChange: (v: string) => void
  onSubmit: (voice: { file: File; url: string } | null) => void
  submitting?: boolean
  disabled?: boolean
}

/**
 * Barre commentaire style WhatsApp : micro vert bien visible (48px), pas caché dans l'input.
 */
export function CommentComposer({
  userInitial = "?",
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
}: CommentComposerProps) {
  const audioInputRef = React.useRef<HTMLInputElement>(null)
  const {
    recording,
    isRecording,
    startRecording,
    stopRecording,
    clearRecording,
    setFromFile,
  } = useVoiceRecorder()

  const canSend = (value.trim().length > 0 || !!recording) && !submitting && !isRecording

  const handleSend = () => {
    if (!canSend) return
    onSubmit(recording ? { file: recording.file, url: recording.url } : null)
    clearRecording()
  }

  return (
    <div className="space-y-3 pt-3 border-t border-[#E5E7EB]">
      {isRecording && (
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-red-50 border border-red-100">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-medium text-red-700 flex-1">Enregistrement… appuyez sur ■ pour terminer</span>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="shrink-0 rounded-full h-10 w-10"
            onClick={stopRecording}
            aria-label="Terminer l'enregistrement"
          >
            <Square className="h-5 w-5 fill-current" />
          </Button>
        </div>
      )}

      {recording && !isRecording && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-[#1F5C2E]/5 border border-[#1F5C2E]/20">
          <div className="w-10 h-10 rounded-full bg-[#1F5C2E] flex items-center justify-center shrink-0">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <audio src={recording.url} controls preload="none" className="flex-1 h-10 min-w-0" />
          <Button type="button" size="icon" variant="ghost" onClick={clearRecording} aria-label="Supprimer">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const check = validateAudioFile(file)
          if (!check.ok) return
          setFromFile(file)
          if (audioInputRef.current) audioInputRef.current.value = ""
        }}
      />

      <div className="flex items-end gap-2">
        <Avatar className="h-9 w-9 shrink-0 mb-0.5">
          <AvatarFallback className="bg-[#1F5C2E] text-white text-xs">{userInitial}</AvatarFallback>
        </Avatar>

        <Button
          type="button"
          size="icon"
          disabled={disabled || submitting}
          className={cn(
            "shrink-0 rounded-full h-12 w-12 shadow-md mb-0.5",
            isRecording ? "bg-red-600 hover:bg-red-700" : "bg-[#1F5C2E] hover:bg-[#174A24]",
          )}
          aria-label={isRecording ? "Arrêter" : "Enregistrer une note vocale"}
          onClick={() => {
            if (isRecording) stopRecording()
            else startRecording(() => audioInputRef.current?.click())
          }}
        >
          {isRecording ? (
            <Square className="h-6 w-6 fill-white text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </Button>

        <div className="flex-1 flex items-center gap-1 bg-[#F3F4F6] rounded-2xl px-3 min-h-[48px] border border-[#E5E7EB]">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Commentaire texte (optionnel)…"
            disabled={disabled || submitting}
            className="border-0 bg-transparent focus-visible:ring-0 px-0 flex-1 h-11"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!canSend}
            onClick={handleSend}
            className="shrink-0 text-[#1F5C2E] disabled:opacity-30"
            aria-label="Envoyer"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-center text-[#6B7280] px-2">
        Micro vert = note vocale · Texte = tap sur 🔊 pour écouter
      </p>
    </div>
  )
}
