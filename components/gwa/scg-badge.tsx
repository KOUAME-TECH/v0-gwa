"use client"

import { cn } from "@/lib/utils"
import { Shield, Star, Award, Crown, Sparkles } from "lucide-react"

interface SCGBadgeProps {
  score: number // 0-1000
  size?: "sm" | "md" | "lg"
  showScore?: boolean
  animated?: boolean
  className?: string
}

// SCG Badge Levels according to GWA spec
const getBadgeLevel = (score: number) => {
  if (score >= 900) return { level: "Diamant", color: "from-cyan-400 to-blue-600", icon: Crown, textColor: "text-cyan-600" }
  if (score >= 750) return { level: "Or", color: "from-yellow-400 to-amber-600", icon: Award, textColor: "text-amber-600" }
  if (score >= 500) return { level: "Argent", color: "from-slate-300 to-slate-500", icon: Star, textColor: "text-slate-600" }
  if (score >= 250) return { level: "Bronze", color: "from-orange-400 to-orange-700", icon: Shield, textColor: "text-orange-600" }
  return { level: "Debutant", color: "from-gray-300 to-gray-500", icon: Sparkles, textColor: "text-gray-500" }
}

export function SCGBadge({ score, size = "md", showScore = true, animated = true, className }: SCGBadgeProps) {
  const { level, color, icon: Icon, textColor } = getBadgeLevel(score)
  
  const sizes = {
    sm: { badge: "w-8 h-8", icon: "h-4 w-4", text: "text-[9px]", score: "text-[10px]" },
    md: { badge: "w-12 h-12", icon: "h-5 w-5", text: "text-[10px]", score: "text-xs" },
    lg: { badge: "w-16 h-16", icon: "h-7 w-7", text: "text-xs", score: "text-sm" },
  }
  
  const s = sizes[size]
  
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div 
        className={cn(
          "relative rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg",
          color,
          s.badge,
          animated && "animate-pulse-soft"
        )}
      >
        <Icon className={cn("text-white drop-shadow-sm", s.icon)} strokeWidth={2} />
        
        {/* Sparkle effect for high scores */}
        {score >= 750 && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/30 to-white/0 animate-shimmer" />
          </div>
        )}
      </div>
      
      {showScore && (
        <div className="flex flex-col items-center">
          <span className={cn("font-bold", textColor, s.score)}>{score}</span>
          <span className={cn("font-medium text-muted-foreground", s.text)}>{level}</span>
        </div>
      )}
    </div>
  )
}

// SCG Gauge - Detailed view for profile/dashboard
interface SCGGaugeProps {
  score: number
  criteria?: {
    transactions: number
    reviews: number
    kyc: number
    activity: number
    network: number
    quality: number
  }
  className?: string
}

export function SCGGauge({ score, criteria, className }: SCGGaugeProps) {
  const { level, color, textColor } = getBadgeLevel(score)
  const percentage = (score / 1000) * 100
  
  const defaultCriteria = criteria || {
    transactions: Math.round(score * 0.25),
    reviews: Math.round(score * 0.20),
    kyc: Math.round(score * 0.15),
    activity: Math.round(score * 0.15),
    network: Math.round(score * 0.15),
    quality: Math.round(score * 0.10),
  }
  
  const criteriaLabels = [
    { key: "transactions", label: "Transactions", max: 250 },
    { key: "reviews", label: "Avis", max: 200 },
    { key: "kyc", label: "Verification", max: 150 },
    { key: "activity", label: "Activite", max: 150 },
    { key: "network", label: "Reseau", max: 150 },
    { key: "quality", label: "Qualite", max: 100 },
  ]
  
  return (
    <div className={cn("bg-card rounded-2xl p-4 border shadow-sm", className)}>
      {/* Main gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-muted/30"
              strokeWidth="3"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={textColor}
              strokeWidth="3"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              strokeDasharray={`${percentage}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-bold", textColor)}>{score}</span>
            <span className="text-[9px] text-muted-foreground font-medium">/1000</span>
          </div>
        </div>
        
        <div className="flex-1">
          <div className={cn("text-lg font-bold", textColor)}>{level}</div>
          <p className="text-xs text-muted-foreground">Score de Confiance GWA</p>
          <div className="flex gap-1 mt-2">
            {[1,2,3,4,5].map(i => (
              <div 
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i <= Math.ceil(score / 200) ? `bg-gradient-to-r ${color}` : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Criteria breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {criteriaLabels.map(({ key, label, max }) => {
          const value = defaultCriteria[key as keyof typeof defaultCriteria]
          const pct = (value / max) * 100
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}/{max}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full bg-gradient-to-r", color)}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
