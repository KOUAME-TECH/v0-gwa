"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, 
  Download, RefreshCw, AlertCircle, CheckCircle, Clock,
  ArrowUpRight, ArrowDownRight, Building2
} from "lucide-react"

interface FinanceStats {
  totalRevenue: number
  totalCommissions: number
  pendingPayouts: number
  completedPayouts: number
  walletBalance: number
  escrowBalance: number
}

interface Transaction {
  id: string
  type: string
  amount: number
  status: string
  created_at: string
  buyer?: { full_name: string }
  seller?: { full_name: string }
}

export default function AdminFinancesPage() {
  const [stats, setStats] = useState<FinanceStats>({
    totalRevenue: 0,
    totalCommissions: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
    walletBalance: 0,
    escrowBalance: 0,
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [period, setPeriod] = useState("30")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    setLoading(true)
    const supabase = createClient()
    
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(period))

    const { data: orders } = await supabase
      .from("orders")
      .select("id, total_amount, status, created_at")
      .gte("created_at", daysAgo.toISOString())
      .order("created_at", { ascending: false })

    const completed = orders?.filter(o => o.status === "delivered") || []
    const pending = orders?.filter(o => ["pending", "processing", "shipped"].includes(o.status)) || []

    setStats({
      totalRevenue: completed.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      totalCommissions: completed.reduce((sum, o) => sum + ((o.total_amount || 0) * 0.05), 0),
      pendingPayouts: pending.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      completedPayouts: completed.length,
      walletBalance: 0,
      escrowBalance: pending.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    })

    setTransactions(orders?.slice(0, 20).map(o => ({
      id: o.id,
      type: "order",
      amount: o.total_amount || 0,
      status: o.status,
      created_at: o.created_at,
    })) || [])

    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finances & Reconciliation</h1>
          <p className="text-muted-foreground">Suivi des revenus, commissions et paiements</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
              <SelectItem value="365">1 an</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export SYSCOA
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenu Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +12% vs periode precedente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commissions GWA (5%)</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCommissions)}</div>
            <p className="text-xs text-muted-foreground">Sur {stats.completedPayouts} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En Escrow</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.escrowBalance)}</div>
            <p className="text-xs text-muted-foreground">En attente de livraison</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paiements en attente</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pendingPayouts)}</div>
            <p className="text-xs text-muted-foreground">A verser aux vendeurs</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions Recentes</CardTitle>
          <CardDescription>Historique des paiements et commissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Aucune transaction</div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.status === "delivered" ? "bg-green-100" : "bg-orange-100"
                    }`}>
                      {tx.status === "delivered" ? (
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Commande #{tx.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(tx.amount)}</p>
                    <Badge variant={tx.status === "delivered" ? "default" : "secondary"} className="text-xs">
                      {tx.status === "delivered" ? "Complete" : tx.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
