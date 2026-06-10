"use client"

import { DIMENSION_META, type SCGDimensions } from "@/lib/scg/engine"
import { cn } from "@/lib/utils"

const BADGE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  excellence: { bg: "bg-[#2F7D32]", text: "text-white", ring: "ring-[#2F7D32]" },
  confirme: { bg: "bg-[#1565C0]", text: "text-white", ring: "ring-[#1565C0]" },
  actif: { bg: "bg-[#00897B]", text: "text-white", ring: "ring-[#00897B]" },
  debutant: { bg: "bg-[#F9A825]", text: "text-white", ring: "ring-[#F9A825]" },
  insuffisant: { bg: "bg-[#9E9E9E]", text: "text-white", ring: "ring-[#9E9E9E]" },
}

export function ScgGauge({
  score,
  badge,
  badgeLabel,
  size = 200,
}: {
  score: number
  badge: string
  badgeLabel: string
  size?: number
}) {
  const radius = (size - 24) / 2
  const circumference = Math.PI * radius // demi-cercle
  const pct = Math.min(1, Math.max(0, score / 1000))
  const dash = circumference * pct
  const style = BADGE_STYLES[badge] ?? BADGE_STYLES.insuffisant

  const strokeColor =
    badge === "excellence"
      ? "#2F7D32"
      : badge === "confirme"
        ? "#1565C0"
        : badge === "actif"
          ? "#00897B"
          : badge === "debutant"
            ? "#F9A825"
            : "#9E9E9E"

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
        <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
          {/* fond */}
          <path
            d={`M 12 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* progression */}
          <path
            d={`M 12 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-4xl font-bold text-[#1A1A1A]">{score}</span>
          <span className="text-xs text-[#6B7280]">/ 1000</span>
        </div>
      </div>
      <span
        className={cn(
          "mt-2 px-4 py-1.5 rounded-full text-sm font-semibold",
          style.bg,
          style.text,
        )}
      >
        {badgeLabel}
      </span>
    </div>
  )
}

export function ScgDimensions({ dimensions }: { dimensions: SCGDimensions }) {
  return (
    <div className="space-y-4">
      {DIMENSION_META.map((meta) => {
        const value = dimensions[meta.key]
        const color = value >= 70 ? "#2F7D32" : value >= 40 ? "#F9A825" : "#E53935"
        return (
          <div key={meta.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-[#1A1A1A]">{meta.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7280]">{meta.weight}%</span>
                <span className="text-sm font-semibold text-[#1A1A1A] tabular-nums w-12 text-right">
                  {value}/100
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${value}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ScgBadgeChip({ badge, badgeLabel, score }: { badge: string; badgeLabel: string; score: number }) {
  const style = BADGE_STYLES[badge] ?? BADGE_STYLES.insuffisant
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", style.bg, style.text)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {badgeLabel} · {score}
    </span>
  )
}
