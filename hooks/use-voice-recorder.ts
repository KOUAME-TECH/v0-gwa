"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { extensionForType } from "@/lib/media/compress"

export type VoiceRecording = {
  file: File
  url: string
  durationMs?: number
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState<VoiceRecording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)

  const clearRecording = useCallback(() => {
    setRecording((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startRecording = useCallback(async (onUnavailable?: () => void) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable?.()
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : ""
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) chunksRef.current.push(evt.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        const ext = extensionForType(type)
        const file = new File([blob], `comment-voice-${Date.now()}.${ext}`, { type })
        const url = URL.createObjectURL(file)
        const durationMs = Date.now() - startedAtRef.current
        setRecording((prev) => {
          if (prev) URL.revokeObjectURL(prev.url)
          return { file, url, durationMs }
        })
        stopStream()
      }
      mediaRecorderRef.current = recorder
      startedAtRef.current = Date.now()
      recorder.start()
      setIsRecording(true)
      return true
    } catch {
      onUnavailable?.()
      return false
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      mediaRecorderRef.current = null
    }
  }, [isRecording])

  const setFromFile = useCallback((file: File) => {
    setRecording((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { file, url: URL.createObjectURL(file) }
    })
  }, [])

  useEffect(() => {
    return () => {
      stopStream()
      setRecording((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return null
      })
    }
  }, [])

  return {
    recording,
    isRecording,
    startRecording,
    stopRecording,
    clearRecording,
    setFromFile,
  }
}
