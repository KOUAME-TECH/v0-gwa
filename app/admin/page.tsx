"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Clock,
  Flag,
  ArrowRight,
  LifeBuoy,
  Banknote,
  Crown,
  ShieldCheck,
  Activity,
  Sparkles,
} from "lucide-react"

interface DashboardStats {
  totalUsers: number
  newUsersToday: number
  totalProducts: number
  pendingProducts: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  openReports: number
  openDisputes: number
  pendingVerifications: number
  openSupport: number
  pendingFactoring: number
  pendingSubscriptions: number
}

interface OpsHealth {
  feexpay: boolean
  sms: boolean
  gemini: boolean
}

interface RecentOrder {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
  buyer: { full_name: string; avatar_url?: string }
}

interface RecentUser {
  id: string
  full_name: string
  email: string
  user_type: string
  created_at: string
  avatar_url?: string
}

interface PendingProduct {
  id: string
  name: string
  price: number
  seller: { full_name: string }
  created_at: string
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    newUsersToday: 0,
    totalProducts: 0,
    pendingProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    openReports: 0,
    openDisputes: 0,
    pendingVerifications: 0,
    openSupport: 0,
    pendingFactoring: 0,
    pendingSubscriptions: 0,
  })
  const [opsHealth, setOpsHealth] = useState<OpsHealth>({
    feexpay: false,
    sms: false,
    gemini: false,
  })
  const [aiQuota, setAiQuota] = useState<{
    remaining: number | null
    limit: number | null
  }>({ remaining: null, limit: null })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [res, aiRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/ai/assist"),
      ])
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (data.stats) setStats(data.stats)
        if (data.opsHealth) setOpsHealth(data.opsHealth)
        if (data.recentOrders) setRecentOrders(data.recentOrders)
        if (data.recentUsers) setRecentUsers(data.recentUsers)
        if (data.pendingProducts) setPendingProducts(data.pendingProducts)
      }
      if (aiRes.ok) {
        const ai = await aiRes.json().catch(() => ({}))
        setAiQuota({
          remaining: typeof ai.aiRemaining === "number" ? ai.aiRemaining : null,
          limit: ai.aiLimit === null ? null : typeof ai.aiLimit === "number" ? ai.aiLimit : null,
        })
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })

  const queue = [
    {
      key: "products",
      count: stats.pendingProducts,
      label: "Produits",
      href: "/admin/products?status=pending",
      icon: Package,
    },
    {
      key: "verifications",
      count: stats.pendingVerifications,
      label: "Vérifications",
      href: "/admin/verifications",
      icon: ShieldCheck,
    },
    {
      key: "disputes",
      count: stats.openDisputes,
      label: "Litiges",
      href: "/admin/disputes",
      icon: AlertTriangle,
    },
    {
      key: "support",
      count: stats.openSupport,
      label: "Support",
      href: "/admin/support",
      icon: LifeBuoy,
    },
    {
      key: "factoring",
      count: stats.pendingFactoring,
      label: "Affacturage",
      href: "/admin/factoring",
      icon: Banknote,
    },
    {
      key: "subscriptions",
      count: stats.pendingSubscriptions,
      label: "Abonnements",
      href: "/admin/subscriptions",
      icon: Crown,
    },
    {
      key: "reports",
      count: stats.openReports,
      label: "Signalements",
      href: "/admin/reports",
      icon: Flag,
    },
  ].filter((q) => q.count > 0)

  const toTreatTotal = queue.reduce((s, q) => s + q.count, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-8 bg-muted rounded w-16 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">À traiter aujourd’hui</h1>
        <p className="text-muted-foreground">
          {toTreatTotal > 0
            ? `${toTreatTotal} élément${toTreatTotal > 1 ? "s" : ""} en file`
            : "Rien en attente — bonne journée"}
        </p>
      </div>

      <Card className="border-[#1F5C2E]/20">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Activity className="h-5 w-5 text-[#1F5C2E]" />
          <span className="text-sm font-medium">Santé ops</span>
          <Badge variant={opsHealth.feexpay ? "default" : "destructive"}>
            FeexPay {opsHealth.feexpay ? "OK" : "✗"}
          </Badge>
          <Badge variant={opsHealth.sms ? "default" : "destructive"}>
            SMS {opsHealth.sms ? "OK" : "✗"}
          </Badge>
          <Badge variant={opsHealth.gemini ? "default" : "secondary"}>
            Gemini {opsHealth.gemini ? "OK" : "✗"}
          </Badge>
          <Badge variant="outline">
            IA{" "}
            {aiQuota.limit == null
              ? "illimitée"
              : `${aiQuota.remaining ?? "—"}/${aiQuota.limit}`}
          </Badge>
        </CardContent>
      </Card>

      {queue.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.key} href={item.href}>
                <Card className="hover:border-[#1F5C2E]/40 transition-colors h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <Icon className="h-5 w-5 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">
                        {item.count} {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">Ouvrir la file</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
          <Link href="/admin/ai">
            <Card className="hover:border-[#1F5C2E]/40 transition-colors h-full border-dashed">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C27D10]/15">
                  <Sparkles className="h-5 w-5 text-[#C27D10]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Yelly Ops</p>
                  <p className="text-xs text-muted-foreground">
                    IA backoffice (quota / rôle)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aucune file active.
            </CardContent>
          </Card>
          <Link href="/admin/ai">
            <Card className="hover:border-[#1F5C2E]/40 transition-colors h-full border-dashed">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C27D10]/15">
                  <Sparkles className="h-5 w-5 text-[#C27D10]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Yelly Ops</p>
                  <p className="text-xs text-muted-foreground">
                    IA backoffice (quota / rôle)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users">
          <Card className="hover:border-[#1F5C2E]/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />+
                {stats.newUsersToday} aujourd’hui
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/products">
          <Card className="hover:border-[#1F5C2E]/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Produits</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingProducts} en attente
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/orders">
          <Card className="hover:border-[#1F5C2E]/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Commandes</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingOrders} en cours
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/finances">
          <Card className="hover:border-[#1F5C2E]/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Volume payé</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">Commandes paid</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produits à modérer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">File vide</p>
            ) : (
              pendingProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.seller?.full_name} · {formatDate(p.created_at)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/products?status=pending`}>Traiter</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dernières commandes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune</p>
            ) : (
              recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={o.buyer?.avatar_url} />
                      <AvatarFallback>
                        {(o.buyer?.full_name || "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {o.order_number || o.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.buyer?.full_name} · {formatCurrency(o.total_amount)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{o.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nouveaux utilisateurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback>{(u.full_name || "?").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">{u.user_type}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(u.created_at)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
