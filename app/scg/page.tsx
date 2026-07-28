"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ScgGauge, ScgDimensions } from "@/components/scg/scg-display"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft, RefreshCw, TrendingUp, Landmark, Info } from "lucide-react"
import Link from "next/link"
import type { SCGResult } from "@/lib/scg/engine"
import { getCoachActions } from "@/lib/scg/coach"
import { ScgCoachPanel } from "@/components/scg/scg-coach"

type ScgSnapshot = {
  score_total: number
  badge: string
  created_at: string
}

export default function ScgPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [result, setResult] = useState<SCGResult | null>(null)
  const [history, setHistory] = useState<ScgSnapshot[]>([])
  const [error, setError] = useState<string | null>(null)

  const badgeLabelFor = (badge: string) => {
    const map: Record<string, string> = {
      excellence: "Excellence",
      confirme: "Confirmé",
      actif: "Actif",
      debutant: "Débutant",
      insuffisant: "Insuffisant",
    }
    return map[badge] ?? "Insuffisant"
  }

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
      return
    }

    // Dernier snapshot
    const { data: latest } = await supabase
      .from("scg_scores")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest) {
      setResult({
        user_id: user.id,
        score_total: latest.score_total,
        badge: latest.badge,
        badge_label: badgeLabelFor(latest.badge),
        dimensions: {
          fiabilite: latest.dim_fiabilite,
          qualite: latest.dim_qualite,
          engagement: latest.dim_engagement,
          volumes: latest.dim_volumes,
          stabilite: latest.dim_stabilite,
        },
        recommandation: latest.recommandation ?? "",
        bancable: latest.bancable,
        calculated_at: latest.created_at,
      })
    }

    // Historique (10 derniers)
    const { data: hist } = await supabase
      .from("scg_scores")
      .select("score_total, badge, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
    if (hist) setHistory(hist.reverse())

    setLoading(false)
  }, [supabase, router])

  const recalculate = useCallback(async (silent = false) => {
    if (!silent) setCalculating(true)
    setError(null)
    try {
      const res = await fetch("/api/scg/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erreur de calcul")
      }
      const data: SCGResult = await res.json()
      setResult(data)
      await loadData()
    } catch {
      setError("Impossible de calculer le score. Réessayez.")
    } finally {
      setCalculating(false)
    }
  }, [loadData])

  useEffect(() => {
    ;(async () => {
      await loadData()
      // Brancher le moteur : calcul auto si aucun score
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: latest } = await supabase
        .from("scg_scores")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
      if (!latest) {
        await recalculate(true)
      }
    })()
  }, [loadData, recalculate, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Spinner className="h-8 w-8 text-[#2F7D32]" />
      </div>
    )
  }

  const maxScore = Math.max(1000, ...history.map((h) => h.score_total))

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link href="/profil" aria-label="Retour">
            <ArrowLeft className="h-5 w-5 text-[#1A1A1A]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#1A1A1A]">Score de Confiance GWA</h1>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {!result ? (
          <Card className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#2F7D32]/10 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-7 w-7 text-[#2F7D32]" />
            </div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-1">Calculez votre SCG</h2>
            <p className="text-sm text-[#6B7280] mb-4 text-pretty">
              Score de fiabilité sur 5 dimensions.
            </p>
            <Button onClick={() => recalculate(false)} disabled={calculating} className="bg-[#2F7D32] hover:bg-[#1B5E20]">
              {calculating ? <Spinner className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Calculer mon score
            </Button>
          </Card>
        ) : (
          <>
            {/* Jauge principale */}
            <Card className="p-6 flex flex-col items-center">
              <ScgGauge
                score={result.score_total}
                badge={result.badge}
                badgeLabel={result.badge_label}
              />
              <p className="text-xs text-[#9CA3AF] mt-3">
                Mis à jour le{" "}
                {new Date(result.calculated_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <Button
                onClick={() => recalculate(false)}
                disabled={calculating}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                {calculating ? <Spinner className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Recalculer
              </Button>
            </Card>

            {/* Statut bancable */}
            <Card
              className={`p-4 flex items-start gap-3 ${
                result.bancable ? "bg-[#2F7D32]/5 border-[#2F7D32]/20" : "bg-[#F9A825]/5 border-[#F9A825]/20"
              }`}
            >
              <Landmark className={`h-5 w-5 mt-0.5 ${result.bancable ? "text-[#2F7D32]" : "text-[#F9A825]"}`} />
              <div>
                <p className="font-semibold text-[#1A1A1A] text-sm">
                  {result.bancable ? "Profil bancable" : "Pas encore bancable"}
                </p>
                <p className="text-sm text-[#6B7280] text-pretty">{result.recommandation}</p>
              </div>
            </Card>

            <ScgCoachPanel score={result.score_total} actions={getCoachActions(result.dimensions)} />

            {/* Dimensions */}
            <Card className="p-5">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">Détail par dimension</h3>
              <ScgDimensions dimensions={result.dimensions} />
            </Card>

            {/* Historique */}
            {history.length > 1 && (
              <Card className="p-5">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Évolution du score</h3>
                <div className="flex items-end gap-2 h-32">
                  {history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-[#2F7D32] transition-all"
                        style={{ height: `${(h.score_total / maxScore) * 100}%`, minHeight: 4 }}
                        title={`${h.score_total}`}
                      />
                      <span className="text-[10px] text-[#9CA3AF]">
                        {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 px-1">
              <Info className="h-4 w-4 text-[#9CA3AF] mt-0.5 shrink-0" />
              <p className="text-xs text-[#9CA3AF] text-pretty">
                Fiabilité 25% · Qualité 20% · Engagement 20% · Volumes 20% · Stabilité 15%.
              </p>
            </div>
          </>
        )}

        {error && <p className="text-sm text-[#E53935] text-center">{error}</p>}
      </div>
    </main>
  )
}
