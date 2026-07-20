"use client"

import { Input } from "@/components/ui/input"
import { COUNTRY_DIAL_CODES } from "@/lib/auth/phone"
import { cn } from "@/lib/utils"

const COUNTRY_OPTIONS = Object.entries(COUNTRY_DIAL_CODES).map(([code, { dial, label }]) => ({
  code,
  dial,
  label,
}))

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  countryCode: string
  onCountryChange: (code: string) => void
  disabled?: boolean
  className?: string
}

export function PhoneInput({
  value,
  onChange,
  countryCode,
  onCountryChange,
  disabled,
  className,
}: PhoneInputProps) {
  const dial = COUNTRY_DIAL_CODES[countryCode]?.dial ?? "+225"

  return (
    <div className={cn("flex gap-2", className)}>
      <select
        value={countryCode}
        onChange={(e) => onCountryChange(e.target.value)}
        disabled={disabled}
        className="h-14 rounded-xl border border-neutral-200 bg-white px-2 text-sm font-medium focus:border-neutral-400 focus:outline-none min-w-[100px]"
        aria-label="Pays"
      >
        {COUNTRY_OPTIONS.map(({ code, dial: d, label }) => (
          <option key={code} value={code}>
            {d} {code.toUpperCase()}
          </option>
        ))}
      </select>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={countryCode === "ci" ? "07 XX XX XX XX" : "Numéro mobile"}
        className="h-14 rounded-xl border-neutral-200 text-[15px] flex-1 focus:border-neutral-400 focus:ring-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      />
      <span className="sr-only">Indicatif {dial}</span>
    </div>
  )
}
