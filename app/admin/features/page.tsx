"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { visibleFeatureFlags, type AdminRole } from "@/lib/auth/admin-permissions"

interface FeatureFlagRow {
  name: string
  is_active_public: boolean
  description: string | null
}

export default function AdminFeaturesPage() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([])
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const visible = useMemo(
    // Fail-closed : tant que le rôle n'est pas super_admin, les drapeaux réglementés restent masqués.
    () => visibleFeatureFlags(flags, role ?? "admin"),
    [flags, role],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/features", { credentials: "include", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Chargement impossible")
      setFlags(Array.isArray(data.flags) ? data.flags : [])
      setRole(data.role === "super_admin" || data.role === "admin" ? data.role : "admin")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (flag: FeatureFlagRow, value: boolean) => {
    setPending(flag.name)
    setError(null)
    try {
      const res = await fetch("/api/admin/features", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flag.name, is_active_public: value }),
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
      <div>
        <h1 className="text-2xl font-bold">Fonctionnalités</h1>
        <p className="text-sm text-muted-foreground">
          Une bascule par drapeau. Chaque changement est tracé dans le journal d&apos;audit.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!loading && visible.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Aucun drapeau en base.</p>
      )}

      <ul className="divide-y">
        {visible.map((flag) => (
          <li key={flag.name} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="font-medium">{flag.name}</div>
              {flag.description && (
                <p className="text-sm text-muted-foreground">{flag.description}</p>
              )}
            </div>
            <Switch
              checked={flag.is_active_public === true}
              disabled={pending !== null}
              onCheckedChange={(v) => void toggle(flag, v)}
              aria-label={flag.name}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
