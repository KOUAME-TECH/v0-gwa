"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageSquare, RefreshCw, Mail, User } from "lucide-react"

type ContactMessage = {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: string
  admin_notes?: string | null
  created_at: string
  user_id?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  spam: "Spam",
}

export default function AdminSupportPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("open")
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [migrationHint, setMigrationHint] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setMigrationHint(null)
    try {
      const res = await fetch(
        `/api/admin/support?status=${encodeURIComponent(filterStatus)}`,
      )
      const data = await res.json().catch(() => ({}))
      if (data.migrationRequired || data.hint) {
        setMigrationHint(data.hint || "Migration 043 requise")
      }
      setMessages((data.messages || []) as ContactMessage[])
    } catch {
      setMessages([])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus])

  const updateStatus = async (status: string) => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_notes: notes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Mise à jour impossible")
        setBusy(false)
        return
      }
      setSelected(null)
      setNotes("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">
            Messages du formulaire Aide &amp; Contact
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Ouverts</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="resolved">Résolus</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {migrationHint && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            {migrationHint}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Inbox ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun message pour ce filtre.
            </p>
          ) : (
            messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelected(m)
                  setNotes(m.admin_notes || "")
                }}
                className="w-full text-left rounded-xl border border-border px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {m.name}
                      <Mail className="h-3 w-3 ml-1" />
                      {m.email}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {m.message}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="secondary">
                      {STATUS_LABEL[m.status] || m.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(m.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{selected.name}</span> ·{" "}
                <a
                  className="text-[#2F7D32] underline"
                  href={`mailto:${selected.email}`}
                >
                  {selected.email}
                </a>
              </p>
              <p className="whitespace-pre-wrap rounded-xl bg-muted p-3">
                {selected.message}
              </p>
              <div className="space-y-1.5">
                <Label>Notes internes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Suivi, réponse donnée…"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="default"
              className="bg-[#1F5C2E] hover:bg-[#184a25]"
              disabled={busy || !selected}
              onClick={() => {
                if (!selected) return
                const subject = encodeURIComponent(`Re: ${selected.subject}`)
                const body = encodeURIComponent(
                  `Bonjour ${selected.name},\n\nMerci pour votre message concernant « ${selected.subject} ».\n\n\n\nCordialement,\nL'équipe GWA`,
                )
                window.open(`mailto:${selected.email}?subject=${subject}&body=${body}`, "_blank")
                void updateStatus("in_progress")
              }}
            >
              Répondre (e-mail)
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void updateStatus("in_progress")}
            >
              En cours
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void updateStatus("spam")}
            >
              Spam
            </Button>
            <Button disabled={busy} onClick={() => void updateStatus("resolved")}>
              Résolu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
