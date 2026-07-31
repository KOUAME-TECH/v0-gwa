"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkles, Send } from "lucide-react"
import { YELLY_OPS_SUGGESTIONS } from "@/lib/admin/ai-prompt"
import { toast } from "sonner"

type Task =
  | "general"
  | "moderation"
  | "support_reply"
  | "dispute_summary"
  | "factoring"
  | "coop"

export default function AdminAiPage() {
  const [message, setMessage] = useState("")
  const [context, setContext] = useState("")
  const [task, setTask] = useState<Task>("general")
  const [reply, setReply] = useState<string | null>(null)
  const [aiRemaining, setAiRemaining] = useState<number | null>(null)
  const [aiLimit, setAiLimit] = useState<number | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/assist")
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAiLimit(data.aiLimit ?? null)
        setAiRemaining(data.aiRemaining ?? null)
        setRole(data.role || null)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  function ask(text?: string) {
    const msg = (text || message).trim()
    if (!msg || pending) return
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/ai/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            task,
            context: context.trim() || undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || "IA indisponible")
          if (data.aiRemaining === 0) setAiRemaining(0)
          return
        }
        setReply(String(data.reply || ""))
        if (typeof data.aiRemaining === "number") setAiRemaining(data.aiRemaining)
        if (typeof data.aiLimit === "number" || data.aiLimit === null) {
          setAiLimit(data.aiLimit)
        }
        setMessage("")
      } catch {
        toast.error("Erreur réseau")
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#C27D10]" />
            Yelly Ops
          </h1>
          <p className="text-sm text-muted-foreground">
            IA backoffice — brouillons actionnables. L’humain valide toujours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {role ? <Badge variant="secondary">{role}</Badge> : null}
          <Badge variant="outline">
            {aiLimit == null
              ? "IA illimitée"
              : `${aiRemaining ?? "—"} / ${aiLimit} restants`}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tâche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={task} onValueChange={(v) => setTask(v as Task)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Général</SelectItem>
              <SelectItem value="moderation">Modération produit</SelectItem>
              <SelectItem value="support_reply">Réponse support</SelectItem>
              <SelectItem value="dispute_summary">Résumé litige</SelectItem>
              <SelectItem value="factoring">Affacturage</SelectItem>
              <SelectItem value="coop">Qualification coop</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Contexte optionnel (extrait ticket, fiche produit, notes…)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
          />
          <Textarea
            placeholder="Que dois-je préparer ?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            {YELLY_OPS_SUGGESTIONS.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => ask(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Button
            className="bg-[#1F5C2E] hover:bg-[#174824]"
            disabled={pending || !message.trim()}
            onClick={() => ask()}
          >
            <Send className="h-4 w-4 mr-2" />
            {pending ? "Yelly Ops écrit…" : "Demander"}
          </Button>
        </CardContent>
      </Card>

      {reply ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Brouillon</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
              {reply}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
