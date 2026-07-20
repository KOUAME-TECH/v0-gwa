"use client"

import React from "react"
import { Send, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { toast } from "sonner"
import { validateAudioFile } from "@/lib/media/compress"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { VoiceMessageChip } from "@/components/media/voice-message-chip"
import { AUDIO_LABELS } from "@/lib/accessibility/audio-labels"

export type CommentComposerProps = {
  userInitial?: string
  value: string
  onChange: (v: string) => void
  onSubmit: (voice: { file: File; url: string } | null) => void
  submitting?: boolean
  loggedIn?: boolean
  onAuthRequired?: () => void
}

/** Barre commentaire épurée — micro discret dans le champ. */
export function CommentComposer({
  userInitial = "?",
  value,
  onChange,
  onSubmit,
  submitting = false,
  loggedIn = true,
  onAuthRequired,
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

  const handleMic = () => {
    if (!loggedIn) {
      onAuthRequired?.()
      return
    }
    if (isRecording) stopRecording()
    else startRecording(() => audioInputRef.current?.click())
  }

  return (
    <div className="space-y-2 pt-3 border-t border-[#E5E7EB]/80">
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50/80 text-red-700 text-sm">
          <AudioWaveIcon playing size="sm" variant="recorded" className="shrink-0" />
          <span className="flex-1">{AUDIO_LABELS.recording}</span>
          <button type="button" onClick={stopRecording} className="p-1 rounded-full hover:bg-red-100" aria-label={AUDIO_LABELS.stop}>
            <Square className="h-4 w-4 fill-current" />
          </button>
        </div>
      )}

      {recording && !isRecording && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-[#1F5C2E]/5 border border-[#1F5C2E]/10">
          <VoiceMessageChip showLabel={false} size="sm" className="pointer-events-none shrink-0" />
          <audio src={recording.url} controls preload="none" className="flex-1 h-8 min-w-0 [&::-webkit-media-controls-panel]:bg-transparent" />
          <button type="button" onClick={clearRecording} className="p-1 text-[#6B7280] hover:text-[#111827]" aria-label="Supprimer">
            <X className="h-4 w-4" />
          </button>
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
          if (!check.ok) {
            toast.error(check.error || "Fichier audio invalide")
            return
          }
          setFromFile(file)
          if (audioInputRef.current) audioInputRef.current.value = ""
        }}
      />

      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-[#1F5C2E]/90 text-white text-xs">{userInitial}</AvatarFallback>
        </Avatar>

        <div className="flex-1 flex items-center gap-1 bg-white rounded-full px-2 min-h-[42px] border border-[#E5E7EB] shadow-sm">
          <button
            type="button"
            disabled={submitting}
            onClick={handleMic}
            className={cn(
              "shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90",
              isRecording
                ? "bg-red-500 text-white"
                : "text-[#1F5C2E] hover:bg-[#1F5C2E]/8",
            )}
            aria-label={isRecording ? AUDIO_LABELS.stop : AUDIO_LABELS.playVoice}
          >
            {isRecording ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <AudioWaveIcon playing={false} size="sm" variant="recorded" />
            )}
          </button>

          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={loggedIn ? "Commentaire…" : "Connectez-vous…"}
            disabled={!loggedIn || submitting}
            className="border-0 bg-transparent focus-visible:ring-0 px-0 flex-1 h-9 text-[15px]"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          <button
            type="button"
            disabled={!canSend}
            onClick={handleSend}
            className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[#1F5C2E] disabled:opacity-25 hover:bg-[#1F5C2E]/8 transition-colors"
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
