"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, RefreshCw, ToggleLeft } from "lucide-react"

interface FeatureFlagRow {
  name: string
  is_active_public: boolean
  is_active_beta: boolean
  description: string | null
  updated_at?: string | null
}

const REGULATED = new Set(["wallet", "internal_wallet"])

export default function AdminFeaturesPage() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/features", { credentials: "include", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Chargement impossible")
      setFlags(Array.isArray(data.flags) ? data.flags : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (flag: FeatureFlagRow, field: "is_active_public" | "is_active_beta", value: boolean) => {
    if (REGULATED.has(flag.name) && value) {
      const ok = window.confirm(
        "Ce drapeau rend le wallet visible. Directive CEO : invisible jusqu'à l'agrément BCEAO. Confirmer ?",
      )
      if (!ok) return
    }
    setPending(`${flag.name}:${field}`)
    setError(null)
    try {
      const res = await fetch("/api/admin/features", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flag.name, [field]: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bascule refusée")
      setFlags((prev) => prev.map((f) => (f.name === flag.name ? { ...f, ...data.flag } : f)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bascule refusée")
    }
    setPending(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ToggleLeft className="h-6 w-6" /> Fonctionnalités
          </h1>
          <p className="text-sm text-muted-foreground">
            Drapeaux de fonctionnalité. Chaque bascule est tracée dans le journal d&apos;audit.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!loading && flags.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Aucun drapeau en base.</p>
      )}

      <div className="grid gap-4">
        {flags.map((flag) => (
          <Card key={flag.name}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <code>{flag.name}</code>
                {REGULATED.has(flag.name) && <Badge variant="destructive">Réglementé (BCEAO)</Badge>}
              </CardTitle>
              {flag.description && <CardDescription>{flag.description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              {(["is_active_public", "is_active_beta"] as const).map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={flag[field] === true}
                    disabled={pending !== null}
                    onCheckedChange={(v) => void toggle(flag, field, v)}
                    aria-label={`${flag.name} ${field === "is_active_public" ? "public" : "bêta"}`}
                  />
                  {field === "is_active_public" ? "Public" : "Bêta"}
                </label>
              ))}
              {flag.updated_at && (
                <span className="text-xs text-muted-foreground">
                  Modifié le {new Date(flag.updated_at).toLocaleString("fr-FR")}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
