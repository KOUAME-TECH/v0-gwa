"use client"

import { cn } from "@/lib/utils"

// Africa First Pictograms - Simple, recognizable icons for low-literacy users
// Per spec: "Pictogrammes > texte. Navigation 100% guidee par audio possible."

interface PictogramProps {
  className?: string
  size?: number
}

// Agriculture / Farming
export function PictoFarmer({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <circle cx="12" cy="6" r="3" fill="currentColor" opacity="0.9"/>
      <path d="M12 10c-3 0-5 2-5 4v2h10v-2c0-2-2-4-5-4z" fill="currentColor" opacity="0.7"/>
      <path d="M8 20l-2-4h12l-2 4" fill="currentColor" opacity="0.5"/>
      <path d="M12 2l1 2-1 1-1-1 1-2z" fill="#2F7D32"/>
    </svg>
  )
}

// Commerce / Shop
export function PictoShop({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <rect x="3" y="8" width="18" height="12" rx="2" fill="currentColor" opacity="0.7"/>
      <path d="M3 8l2-4h14l2 4" fill="currentColor" opacity="0.9"/>
      <circle cx="8" cy="14" r="2" fill="#2F7D32"/>
      <circle cx="16" cy="14" r="2" fill="#F39A1F"/>
    </svg>
  )
}

// Produce / Vegetables
export function PictoProduce({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <ellipse cx="12" cy="14" rx="7" ry="6" fill="#F39A1F" opacity="0.8"/>
      <path d="M12 4c2 0 3 3 3 6s-1 3-3 3-3 0-3-3 1-6 3-6z" fill="#2F7D32"/>
      <path d="M11 4l1-2 1 2" stroke="#2F7D32" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Artisan / Crafts
export function PictoArtisan({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <path d="M4 18l4-8 4 8H4z" fill="#8B4513" opacity="0.8"/>
      <circle cx="16" cy="10" r="5" fill="currentColor" opacity="0.7"/>
      <path d="M14 10h4M16 8v4" stroke="#F39A1F" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// Money / Payment
export function PictoMoney({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" opacity="0.7"/>
      <circle cx="12" cy="12" r="4" fill="#2F7D32"/>
      <text x="12" y="14" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">F</text>
    </svg>
  )
}

// Chat / Message
export function PictoChat({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" fill="currentColor" opacity="0.7"/>
      <circle cx="8" cy="11" r="1.5" fill="#1DA1F2"/>
      <circle cx="12" cy="11" r="1.5" fill="#1DA1F2"/>
      <circle cx="16" cy="11" r="1.5" fill="#1DA1F2"/>
    </svg>
  )
}

// Location / Map
export function PictoLocation({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="currentColor" opacity="0.8"/>
      <circle cx="12" cy="9" r="3" fill="#2F7D32"/>
    </svg>
  )
}

// Truck / Delivery
export function PictoTruck({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <rect x="1" y="8" width="12" height="8" rx="1" fill="currentColor" opacity="0.7"/>
      <path d="M13 10h5l3 4v2h-8v-6z" fill="currentColor" opacity="0.9"/>
      <circle cx="5" cy="18" r="2" fill="#2F7D32"/>
      <circle cx="17" cy="18" r="2" fill="#2F7D32"/>
    </svg>
  )
}

// Verified / Check
export function PictoVerified({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <circle cx="12" cy="12" r="10" fill="#2F7D32"/>
      <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Star / Rating
export function PictoStar({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z" fill="#F39A1F"/>
    </svg>
  )
}

// Sound / Audio guide
export function PictoAudio({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" opacity="0.8"/>
      <path d="M16 8c1.5 1 2 2.5 2 4s-.5 3-2 4" stroke="#2F7D32" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 5c3 2 4 5 4 7s-1 5-4 7" stroke="#2F7D32" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Offline / No connection
export function PictoOffline({ className, size = 24 }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 12c0-2 2-4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="2" fill="currentColor"/>
    </svg>
  )
}

// Mobile Money (Orange/MTN/Wave)
export function PictoMobileMoney({ className, size = 24, provider }: PictogramProps & { provider?: "orange" | "mtn" | "wave" }) {
  const colors = {
    orange: { primary: "#FF6600", secondary: "#000000" },
    mtn: { primary: "#FFCC00", secondary: "#004F9F" },
    wave: { primary: "#1DA1F2", secondary: "#FFFFFF" },
  }
  const c = provider ? colors[provider] : { primary: "#2F7D32", secondary: "#FFFFFF" }
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("text-current", className)}>
      <rect x="5" y="2" width="14" height="20" rx="3" fill={c.primary}/>
      <rect x="7" y="5" width="10" height="12" rx="1" fill={c.secondary} opacity="0.9"/>
      <circle cx="12" cy="19" r="1.5" fill={c.secondary}/>
    </svg>
  )
}
