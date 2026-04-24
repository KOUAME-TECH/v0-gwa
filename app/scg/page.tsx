"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SCGBadge, SCGGauge } from "@/components/gwa/scg-badge"
import { 
  ArrowLeft, TrendingUp, TrendingDown, Minus, 
  CheckCircle2, AlertCircle, Info, ChevronRight,
  Star, Shield, Award, Users, Activity, Package
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SCGHistory {
  id: string
  score_before: number
  score_after: number
  delta: number
  reason: string
  created_at: string
}

interface SCGCriteria {
  transactions: number
  reviews: number
  kyc: number
  activity: number
  network: number
  quality: number
}

export default function SCGDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [criteria, setCriteria] = useState<SCGCriteria | null>(null)
  const [history, setHistory] = useState<SCGHistory[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  
  useEffect(() => {
    const loadSCGData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoading(false)
        return
      }
      
      // Load profile with SCG score
      const { data: profile } = await supabase
        .from("profiles")
        .select("scg_score, scg_criteria")
        .eq("id", user.id)
        .single()
      
      if (profile) {
        setScore(profile.scg_score || 0)
        setCriteria(profile.scg_criteria as SCGCriteria || null)
      }
      
      // Load SCG history (simulated - would come from scg_events table)
      // For MVP, we generate sample history
      setHistory([
        { id: "1", score_before: 320, score_after: 350, delta: 30, reason: "Transaction completee avec succes", created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: "2", score_before: 300, score_after: 320, delta: 20, reason: "Avis positif recu", created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: "3", score_before: 280, score_after: 300, delta: 20, reason: "Verification KYC completee", created_at: new Date(Date.now() - 259200000).toISOString() },
      ])
      
      // Generate suggestions based on criteria
      const s: string[] = []
      if (!criteria || criteria.kyc < 150) s.push("Completez votre verification d'identite pour +50 points")
      if (!criteria || criteria.reviews < 100) s.push("Demandez des avis a vos acheteurs pour +20 points par avis")
      if (!criteria || criteria.transactions < 100) s.push("Completez plus de transactions pour augmenter votre score")
      setSuggestions(s)
      
      setLoading(false)
    }
    
    loadSCGData()
  }, [])
  
  const criteriaIcons = {
    transactions: Package,
    reviews: Star,
    kyc: Shield,
    activity: Activity,
    network: Users,
    quality: Award,
  }
  
  const criteriaLabels = {
    transactions: "Transactions",
    reviews: "Avis recus",
    kyc: "Verification",
    activity: "Activite",
    network: "Reseau",
    quality: "Qualite",
  }
  
  const criteriaDescriptions = {
    transactions: "Nombre et valeur des transactions completees",
    reviews: "Avis positifs recus de vos clients",
    kyc: "Documents d'identite verifies",
    activity: "Regularite de votre presence sur GWA",
    network: "Connexions et followers",
    quality: "Qualite de vos annonces et photos",
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="gwa-skeleton w-20 h-20 rounded-full" />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#2F7D32] to-[#1B5E20] text-white">
        <div className="flex items-center gap-3 p-4">
          <Link href="/profil" className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Score de Confiance GWA</h1>
            <p className="text-xs text-white/80">SCG - Systeme de Confiance GWA</p>
          </div>
          <button className="p-2 rounded-full hover:bg-white/10">
            <Info className="h-5 w-5" />
          </button>
        </div>
      </header>
      
      <div className="p-4 space-y-4">
        {/* Main Score Card */}
        <Card className="p-6 bg-gradient-to-br from-white to-[#f0fdf4] border-[#2F7D32]/20">
          <div className="flex items-center gap-6">
            <SCGBadge score={score} size="lg" animated />
            <div className="flex-1">
              <div className="text-3xl font-bold text-[#2F7D32]">{score}</div>
              <div className="text-sm text-muted-foreground">sur 1000 points</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-4 w-4 text-[#2F7D32]" />
                <span className="text-sm font-medium text-[#2F7D32]">+30 cette semaine</span>
              </div>
            </div>
          </div>
        </Card>
        
        {/* SCG Gauge - Detailed breakdown */}
        <SCGGauge score={score} criteria={criteria || undefined} />
        
        {/* Suggestions to improve */}
        {suggestions.length > 0 && (
          <Card className="p-4 border-[#F39A1F]/30 bg-[#F39A1F]/5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#F39A1F]" />
              Ameliorez votre score
            </h3>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-[#F39A1F] mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* Criteria Detail */}
        <div>
          <h3 className="font-semibold mb-3">Details des criteres</h3>
          <div className="space-y-2">
            {Object.entries(criteriaLabels).map(([key, label]) => {
              const Icon = criteriaIcons[key as keyof typeof criteriaIcons]
              const value = criteria?.[key as keyof SCGCriteria] || 0
              const maxValues = { transactions: 250, reviews: 200, kyc: 150, activity: 150, network: 150, quality: 100 }
              const max = maxValues[key as keyof typeof maxValues]
              const pct = (value / max) * 100
              
              return (
                <Card key={key} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2F7D32]/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-[#2F7D32]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{label}</span>
                        <span className="text-sm font-bold text-[#2F7D32]">{value}/{max}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#2F7D32] to-[#4CAF50] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {criteriaDescriptions[key as keyof typeof criteriaDescriptions]}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
        
        {/* History */}
        <div>
          <h3 className="font-semibold mb-3">Historique recent</h3>
          <div className="space-y-2">
            {history.map(item => (
              <Card key={item.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    item.delta > 0 ? "bg-[#2F7D32]/10" : item.delta < 0 ? "bg-destructive/10" : "bg-muted"
                  )}>
                    {item.delta > 0 ? (
                      <TrendingUp className="h-4 w-4 text-[#2F7D32]" />
                    ) : item.delta < 0 ? (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("fr-FR", { 
                        day: "numeric", month: "short" 
                      })}
                    </p>
                  </div>
                  <div className={cn(
                    "text-sm font-bold",
                    item.delta > 0 ? "text-[#2F7D32]" : item.delta < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {item.delta > 0 ? "+" : ""}{item.delta}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        {/* CTA */}
        <Card className="p-4 bg-gradient-to-r from-[#2F7D32] to-[#1B5E20] text-white">
          <h3 className="font-bold mb-1">Boostez votre visibilite</h3>
          <p className="text-sm text-white/80 mb-3">
            Un score SCG eleve vous place en haut des resultats de recherche
          </p>
          <Link href="/publier">
            <Button variant="secondary" className="w-full">
              Publier un produit
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
