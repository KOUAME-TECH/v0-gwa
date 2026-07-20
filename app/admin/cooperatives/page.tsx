"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Building2, ExternalLink } from "lucide-react"

interface CoopRow {
  id: string
  name: string
  sector: string | null
  city: string | null
  country: string | null
  is_verified: boolean
  phone: string | null
  email: string | null
  created_at: string
}

export default function AdminCooperativesPage() {
  const [rows, setRows] = useState<CoopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("cooperatives")
      .select("id, name, sector, city, country, is_verified, phone, email, created_at")
      .order("created_at", { ascending: false })
      .limit(200)

    if (err) {
      setError(err.message)
      setRows([])
    } else {
      setRows((data as CoopRow[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return (
      r.name?.toLowerCase().includes(s) ||
      r.city?.toLowerCase().includes(s) ||
      r.sector?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coopératives</h1>
          <p className="text-sm text-muted-foreground">
            Liste des coopératives agricoles (lecture + suivi)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {filtered.length} coopérative{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
          <Input
            placeholder="Rechercher (nom, ville, secteur…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune coopérative trouvée.</p>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.is_verified ? (
                      <Badge className="bg-emerald-600">Vérifiée</Badge>
                    ) : (
                      <Badge variant="secondary">Non vérifiée</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[c.sector, c.city, c.country].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {(c.phone || c.email) && (
                    <p className="text-xs text-muted-foreground">
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/cooperatives`}>
                    Voir côté public
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
