"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Flag,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Package,
  MessageSquare,
} from "lucide-react"

interface Report {
  id: string
  reported_type: string
  reported_id: string
  reason: string
  description: string
  evidence_urls?: string[]
  status: string
  resolution_notes?: string
  created_at: string
  reporter: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("pending")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [filterStatus])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports?status=${encodeURIComponent(filterStatus)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReports([])
        setLoading(false)
        return
      }
      setReports((data.reports || []) as Report[])
    } catch {
      setReports([])
    }
    setLoading(false)
  }

  const handleResolve = async (action: "resolved" | "dismissed") => {
    if (!selectedReport) return
    setActionLoading(true)

    try {
      const res = await fetch(`/api/admin/reports/${selectedReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: resolutionNotes || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Action impossible")
        setActionLoading(false)
        return
      }

      setReports((prev) => prev.filter((r) => r.id !== selectedReport.id))
      setResolveDialogOpen(false)
      setResolutionNotes("")
      setSelectedReport(null)
    } catch {
      alert("Erreur réseau")
    }
    setActionLoading(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      spam: "Spam",
      inappropriate: "Contenu inapproprie",
      fraud: "Fraude",
      counterfeit: "Contrefacon",
      harassment: "Harcelement",
      other: "Autre",
    }
    return reasons[reason] || reason
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "user":
        return <User className="h-4 w-4" />
      case "product":
        return <Package className="h-4 w-4" />
      case "post":
        return <MessageSquare className="h-4 w-4" />
      default:
        return <Flag className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Signalements</h1>
          <p className="text-muted-foreground">{reports.length} signalement(s)</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="resolved">Resolus</SelectItem>
              <SelectItem value="dismissed">Rejetes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchReports} className="bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-muted-foreground">Aucun signalement en attente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                      {getTypeIcon(report.reported_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{report.reported_type}</Badge>
                        <Badge variant="secondary">{getReasonLabel(report.reason)}</Badge>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2">{report.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={report.reporter?.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{report.reporter?.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{report.reporter?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report)
                          setResolveDialogOpen(true)
                        }}
                        className="bg-transparent"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Traiter
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Traiter le signalement</DialogTitle>
            <DialogDescription>
              Examinez ce signalement et prenez les mesures appropriees.
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedReport.reported_type}</Badge>
                  <Badge variant="secondary">{getReasonLabel(selectedReport.reason)}</Badge>
                </div>
                <p className="text-sm">{selectedReport.description}</p>
                {selectedReport.evidence_urls && selectedReport.evidence_urls.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {selectedReport.evidence_urls.map((url, i) => (
                      <img 
                        key={i}
                        src={url || "/placeholder.svg"} 
                        alt={`Evidence ${i + 1}`}
                        className="h-16 w-16 rounded object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes de resolution</Label>
                <Textarea
                  id="notes"
                  placeholder="Decrivez les actions prises..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setResolveDialogOpen(false)}
              className="bg-transparent"
            >
              Annuler
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleResolve("dismissed")}
              disabled={actionLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeter
            </Button>
            <Button 
              onClick={() => handleResolve("resolved")}
              disabled={actionLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resoudre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
