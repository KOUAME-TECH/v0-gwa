"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, 
  XCircle, RefreshCw, Smartphone, Building2, History,
  TrendingUp, AlertCircle
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface Transaction {
  id: string
  type: 'credit' | 'debit' | 'withdrawal' | 'refund'
  amount: number
  status: 'pending' | 'completed' | 'failed'
  description: string
  reference: string | null
  created_at: string
}

interface WalletData {
  balance: number
  pending_balance: number
  total_earned: number
  total_withdrawn: number
}

export default function WalletPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [wallet, setWallet] = useState<WalletData>({
    balance: 0,
    pending_balance: 0,
    total_earned: 0,
    total_withdrawn: 0
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawMethod, setWithdrawMethod] = useState("orange_money")
  const [withdrawPhone, setWithdrawPhone] = useState("")
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadWalletData()
  }, [])

  async function loadWalletData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)

    // Get profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    setProfile(profileData)
    setWithdrawPhone(profileData?.phone || "")

    // Calculate wallet balance from completed orders (seller)
    const { data: completedOrders } = await supabase
      .from('orders')
      .select('total_amount, service_fee, vendeur_recoit_fcfa, commission_fcfa')
      .eq('seller_id', user.id)
      .eq('status', 'delivered')
      .eq('payment_status', 'paid')

    type OrderMoney = {
      total_amount?: number | null
      service_fee?: number | null
      vendeur_recoit_fcfa?: number | null
      commission_fcfa?: number | null
    }

    const sellerNet = (order: OrderMoney) => {
      if (order.vendeur_recoit_fcfa != null) return Number(order.vendeur_recoit_fcfa) || 0
      const total = Number(order.total_amount) || 0
      const commission = Number(order.commission_fcfa) || 0
      if (commission > 0) return Math.max(0, total - commission)
      return Math.max(0, total - (Number(order.service_fee) || 0))
    }

    const totalEarned =
      (completedOrders as OrderMoney[] | null)?.reduce((sum: number, order: OrderMoney) => {
        return sum + sellerNet(order)
      }, 0) || 0

    // Calculate pending balance (orders not yet delivered)
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('total_amount, service_fee, vendeur_recoit_fcfa, commission_fcfa')
      .eq('seller_id', user.id)
      .in('status', ['confirmed', 'preparing', 'shipping'])
      .eq('payment_status', 'paid')

    const pendingBalance =
      (pendingOrders as OrderMoney[] | null)?.reduce((sum: number, order: OrderMoney) => {
        return sum + sellerNet(order)
      }, 0) || 0

    let totalWithdrawn = 0
    const withdrawTxns: Transaction[] = []
    try {
      const wRes = await fetch("/api/wallet/withdraw")
      const wData = await wRes.json().catch(() => ({}))
      const rows = (wData.withdrawals || []) as {
        id: string
        amount_fcfa: number
        status: string
        feexpay_ref?: string | null
        created_at: string
      }[]
      totalWithdrawn = rows
        .filter((w) => ["pending", "processing", "paid"].includes(w.status))
        .reduce((s, w) => s + (Number(w.amount_fcfa) || 0), 0)
      for (const w of rows) {
        withdrawTxns.push({
          id: w.id,
          type: "withdrawal",
          amount: Number(w.amount_fcfa) || 0,
          status:
            w.status === "paid"
              ? "completed"
              : w.status === "failed"
                ? "failed"
                : "pending",
          description: "Retrait Mobile Money",
          reference: w.feexpay_ref || null,
          created_at: w.created_at,
        })
      }
    } catch {
      /* API absente / migration */
    }
    
    setWallet({
      balance: Math.max(0, totalEarned - totalWithdrawn),
      pending_balance: pendingBalance,
      total_earned: totalEarned,
      total_withdrawn: totalWithdrawn
    })

    const creditTxns: Transaction[] =
      (completedOrders as OrderMoney[] | null)?.map((order: OrderMoney, i: number) => ({
      id: `credit-${i}`,
      type: 'credit' as const,
      amount: sellerNet(order),
      status: 'completed' as const,
      description: 'Vente livrée',
      reference: null,
      created_at: new Date(Date.now() - i * 86400000).toISOString()
    })) || []

    setTransactions([...withdrawTxns, ...creditTxns])
    setLoading(false)
  }

  const handleWithdraw = async () => {
    if (!user) return
    
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Montant invalide")
      return
    }

    if (amount > wallet.balance) {
      setError("Solde insuffisant")
      return
    }

    if (amount < 1000) {
      setError("Le montant minimum de retrait est de 1,000 FCFA")
      return
    }

    if (!withdrawPhone || withdrawPhone.length < 8) {
      setError("Numéro de téléphone invalide")
      return
    }

    setWithdrawing(true)
    setError(null)

    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_fcfa: amount,
          phone: withdrawPhone,
          network: "orange",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Retrait impossible")
        setWithdrawing(false)
        return
      }
      setShowWithdrawDialog(false)
      setWithdrawAmount("")
      await loadWalletData()
      if (data.status === "paid") {
        // ok
      }
    } catch {
      setError("Erreur réseau")
    } finally {
      setWithdrawing(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />
      case 'debit':
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />
      case 'refund':
        return <RefreshCw className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Complété</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">En attente</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Échoué</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mon Portefeuille</h1>
          <p className="text-muted-foreground">
            Gérez vos revenus et effectuez des retraits vers Mobile Money
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Solde disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{formatAmount(wallet.balance)}</span>
                <Wallet className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{formatAmount(wallet.pending_balance)}</span>
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Commandes en cours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total gagné</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{formatAmount(wallet.total_earned)}</span>
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total retiré</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{formatAmount(wallet.total_withdrawn)}</span>
                <ArrowUpRight className="h-6 w-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <Button 
            size="lg" 
            onClick={() => setShowWithdrawDialog(true)}
            disabled={wallet.balance < 1000}
          >
            <ArrowUpRight className="h-5 w-5 mr-2" />
            Retirer des fonds
          </Button>
          <Button variant="outline" size="lg" onClick={loadWalletData}>
            <RefreshCw className="h-5 w-5 mr-2" />
            Actualiser
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/affacturage")}>
            <Building2 className="h-5 w-5 mr-2" />
            Affacturage
          </Button>
        </div>

        {/* Info Card */}
        {wallet.balance < 1000 && (
          <Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">Montant minimum de retrait</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Vous devez avoir au moins 1,000 FCFA de solde disponible pour effectuer un retrait.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Toutes les transactions</TabsTrigger>
            <TabsTrigger value="credits">Entrées</TabsTrigger>
            <TabsTrigger value="withdrawals">Retraits</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {transactions.length === 0 ? (
              <Card className="p-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune transaction</h3>
                <p className="text-muted-foreground">
                  Vos transactions apparaîtront ici après vos premières ventes
                </p>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {transactions.map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            txn.type === 'credit' ? 'bg-green-100' : 
                            txn.type === 'withdrawal' ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            {getTransactionIcon(txn.type)}
                          </div>
                          <div>
                            <p className="font-medium">{txn.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(txn.created_at), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            txn.type === 'credit' || txn.type === 'refund' 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {txn.type === 'credit' || txn.type === 'refund' ? '+' : '-'}
                            {formatAmount(txn.amount)}
                          </p>
                          {getStatusBadge(txn.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="credits" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {transactions.filter(t => t.type === 'credit' || t.type === 'refund').map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div>
                          <p className="font-medium">{txn.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(txn.created_at), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">+{formatAmount(txn.amount)}</p>
                        {getStatusBadge(txn.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-6">
            {transactions.filter(t => t.type === 'withdrawal').length === 0 ? (
              <Card className="p-12 text-center">
                <ArrowUpRight className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun retrait</h3>
                <p className="text-muted-foreground">
                  Vos retraits apparaîtront ici
                </p>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {transactions.filter(t => t.type === 'withdrawal').map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                            {getTransactionIcon(txn.type)}
                          </div>
                          <div>
                            <p className="font-medium">{txn.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(txn.created_at), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">-{formatAmount(txn.amount)}</p>
                          {getStatusBadge(txn.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer des fonds</DialogTitle>
            <DialogDescription>
              Transférez vos gains vers votre compte Mobile Money
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Solde disponible</p>
              <p className="text-2xl font-bold">{formatAmount(wallet.balance)}</p>
            </div>

            <div className="space-y-2">
              <Label>Montant à retirer (FCFA)</Label>
              <Input
                type="number"
                placeholder="10000"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min={1000}
                max={wallet.balance}
              />
              <p className="text-xs text-muted-foreground">Minimum: 1,000 FCFA</p>
            </div>

            <div className="space-y-2">
              <Label>Méthode de retrait</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={withdrawMethod === "orange_money" ? "default" : "outline"}
                  className={withdrawMethod !== "orange_money" ? "bg-transparent" : ""}
                  onClick={() => setWithdrawMethod("orange_money")}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Orange
                </Button>
                <Button
                  type="button"
                  variant={withdrawMethod === "mtn_money" ? "default" : "outline"}
                  className={withdrawMethod !== "mtn_money" ? "bg-transparent" : ""}
                  onClick={() => setWithdrawMethod("mtn_money")}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  MTN
                </Button>
                <Button
                  type="button"
                  variant={withdrawMethod === "moov_money" ? "default" : "outline"}
                  className={withdrawMethod !== "moov_money" ? "bg-transparent" : ""}
                  onClick={() => setWithdrawMethod("moov_money")}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Moov
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Numéro de téléphone</Label>
              <Input
                type="tel"
                placeholder="07 XX XX XX XX"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? "Traitement..." : "Confirmer le retrait"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
