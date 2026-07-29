"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Shield, Info } from "lucide-react"

type Dims = {
  fiabilite: number
  qualite: number
  engagement: number
  volumes: number
  stabilite: number
}

type ScgUser = {
  id: string
  full_name: string | null
  user_type: string | null
  city: string | null
  scg_score: number | null
  scg_badge: string | null
  scg_bancable: boolean | null
  dimensions: Dims | null
  recommandation: string | null
}

type DimMeta = { key: keyof Dims; label: string; weight: number }

/**
 * Admin SCG v1 lean — dimensions réelles + export.
 * Configuration poids interactive (ancienne UI) retirée : non branchée au moteur.
 */
export default function AdminSCGPage() {
  const [users, setUsers] = useState<ScgUser[]>([])
  const [meta, setMeta] = useState<DimMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/scg")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Chargement impossible")
      setUsers(data.users || [])
      setMeta(data.dimensions_meta || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const exportCsv = () => {
    window.location.href = "/api/admin/export?entity=users"
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">SCG — Score de Confiance</h1>
          <p className="text-sm text-[#4B5563]">
            Moteur v1 (bêta) · dimensions transactionnelles · seuils 500 / 600 / 800
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-[var(--gwa-primary,#1F5C2E)]/20 bg-[var(--gwa-primary-soft,#F0F7F2)]">
        <CardContent className="p-4 flex gap-3 text-sm text-[#111827]">
          <Info className="h-5 w-5 shrink-0 text-[var(--gwa-primary,#1F5C2E)]" />
          <div>
            <p className="font-medium">Bêta lean — SCG v2 5C reporté post-bêta</p>
            <p className="text-[#4B5563] mt-1">
              Le modèle bancaire 5C (SCG v2) est prévu post-bêta — voir roadmap CdC.
              En bêta : score 0–1000, <strong>bancable ≥ 500</strong>, snapshot sur
              demandes d&apos;affacturage.
            </p>
          </div>
        </CardContent>
      </Card>

      {meta.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {meta.map((d) => (
            <Card key={d.key} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-[#4B5563] line-clamp-2">{d.label}</p>
                <p className="text-lg font-bold text-[var(--gwa-primary,#1F5C2E)]">{d.weight}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Profils scorés
          </CardTitle>
          <CardDescription>Dernier snapshot dimensions (table scg_scores)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-[#4B5563]">Chargement…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-[#4B5563]">Aucun score SCG enregistré.</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-[#E5E7EB] p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{u.full_name || "Sans nom"}</p>
                    <p className="text-xs text-[#4B5563]">
                      {[u.user_type, u.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-[var(--gwa-primary,#1F5C2E)]">
                      {u.scg_score ?? 0}
                    </p>
                    {u.scg_bancable ? (
                      <Badge className="bg-green-100 text-green-700">Bancable</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">{u.scg_badge || "—"}</Badge>
                    )}
                  </div>
                </div>
                {u.dimensions && (
                  <div className="grid grid-cols-5 gap-1 text-center text-[10px] sm:text-xs">
                    {(
                      [
                        ["F", u.dimensions.fiabilite],
                        ["Q", u.dimensions.qualite],
                        ["E", u.dimensions.engagement],
                        ["V", u.dimensions.volumes],
                        ["S", u.dimensions.stabilite],
                      ] as const
                    ).map(([label, val]) => (
                      <div key={label} className="rounded-lg bg-[#F9FAFB] py-1">
                        <div className="font-semibold text-[#111827]">{val}</div>
                        <div className="text-[#4B5563]">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {u.recommandation && (
                  <p className="text-xs text-[#4B5563]">{u.recommandation}</p>
                )}
                <Link
                  href={`/admin/users`}
                  className="text-xs text-[var(--gwa-primary,#1F5C2E)] font-medium"
                >
                  Voir utilisateurs →
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
