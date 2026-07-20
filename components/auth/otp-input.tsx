"use client"

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from "react"
import { cn } from "@/lib/utils"

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  className,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(length, " ").slice(0, length).split("")

  const focusAt = (index: number) => {
    inputsRef.current[index]?.focus()
    inputsRef.current[index]?.select()
  }

  const updateDigit = (index: number, digit: string) => {
    const next = digits.map((d, i) => (i === index ? digit : d === " " ? "" : d))
    onChange(next.join("").replace(/\s/g, ""))
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      if (digits[index] && digits[index] !== " ") {
        updateDigit(index, "")
      } else if (index > 0) {
        focusAt(index - 1)
        updateDigit(index - 1, "")
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      focusAt(index - 1)
    } else if (e.key === "ArrowRight" && index < length - 1) {
      focusAt(index + 1)
    }
  }

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1)
    if (!digit) return
    updateDigit(index, digit)
    if (index < length - 1) focusAt(index + 1)
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (pasted) {
      onChange(pasted)
      focusAt(Math.min(pasted.length, length - 1))
    }
  }

  useEffect(() => {
    if (!disabled) focusAt(0)
  }, [disabled])

  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digits[i] === " " ? "" : digits[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "w-12 h-14 text-center text-xl font-semibold rounded-xl border-2 border-neutral-200",
            "focus:border-neutral-900 focus:outline-none focus:ring-0",
            "disabled:opacity-50 disabled:bg-neutral-50",
          )}
          aria-label={`Chiffre ${i + 1}`}
        />
      ))}
    </div>
  )
}

interface OtpCountdownProps {
  expiresAt: number
  onExpired?: () => void
}

export function OtpCountdown({ expiresAt, onExpired }: OtpCountdownProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) onExpired?.()
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onExpired])

  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  return (
    <span className="tabular-nums text-neutral-500">
      {min}:{sec.toString().padStart(2, "0")}
    </span>
  )
}
