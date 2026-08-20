"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ArrowUpRight, ArrowDownLeft, Clock, RefreshCw, Smartphone, Building2, History,
  AlertCircle
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { isSellerRole } from "@/lib/dashboard/routing"
import { ProducerSubnav } from "@/components/producer/producer-subnav"
import Link from "next/link"

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

    if (!isSellerRole(profileData?.user_type)) {
      setLoading(false)
      return
    }

    // Solde Wallet via API (exclut payout déjà paid — anti double cash-out)
    type OrderMoney = {
      total_amount?: number | null
      service_fee?: number | null
      vendeur_recoit_fcfa?: number | null
      commission_fcfa?: number | null
      payout_status?: string | null
      escrow_status?: string | null
    }

    const sellerNet = (order: OrderMoney) => {
      if (order.vendeur_recoit_fcfa != null) return Number(order.vendeur_recoit_fcfa) || 0
      const total = Number(order.total_amount) || 0
      const commission = Number(order.commission_fcfa) || 0
      if (commission > 0) return Math.max(0, total - commission)
      return Math.max(0, total - (Number(order.service_fee) || 0))
    }

    let totalEarned = 0
    let totalWithdrawn = 0
    let availableFromApi: number | null = null
    const withdrawTxns: Transaction[] = []
    try {
      const wRes = await fetch("/api/wallet/withdraw")
      const wData = await wRes.json().catch(() => ({}))
      if (Number.isFinite(Number(wData.gross_fcfa))) totalEarned = Number(wData.gross_fcfa)
      if (Number.isFinite(Number(wData.withdrawn_fcfa))) {
        totalWithdrawn = Number(wData.withdrawn_fcfa)
      }
      if (Number.isFinite(Number(wData.balance_fcfa))) {
        availableFromApi = Number(wData.balance_fcfa)
      }
      const rows = (wData.withdrawals || []) as {
        id: string
        amount_fcfa: number
        status: string
        feexpay_ref?: string | null
        created_at: string
      }[]
      if (!Number.isFinite(Number(wData.withdrawn_fcfa))) {
        totalWithdrawn = rows
          .filter((w) => ["pending", "processing", "paid"].includes(w.status))
          .reduce((s, w) => s + (Number(w.amount_fcfa) || 0), 0)
      }
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

    const { data: completedOrders } = await supabase
      .from("orders")
      .select(
        "total_amount, service_fee, vendeur_recoit_fcfa, commission_fcfa, payout_status, escrow_status",
      )
      .eq("seller_id", user.id)
      .eq("payment_status", "paid")
      .eq("escrow_status", "released")

    if (totalEarned === 0) {
      totalEarned =
        (completedOrders as OrderMoney[] | null)?.reduce((sum, order) => {
          const ps = (order.payout_status || "").toLowerCase()
          if (["paid", "skipped_sim", "processing", "skipped_zero"].includes(ps)) {
            return sum
          }
          return sum + sellerNet(order)
        }, 0) || 0
    }

    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("total_amount, service_fee, vendeur_recoit_fcfa, commission_fcfa")
      .eq("seller_id", user.id)
      .eq("payment_status", "paid")
      .eq("escrow_status", "held")

    const pendingBalance =
      (pendingOrders as OrderMoney[] | null)?.reduce((sum, order) => {
        return sum + sellerNet(order)
      }, 0) || 0

    setWallet({
      balance:
        availableFromApi != null
          ? Math.max(0, availableFromApi)
          : Math.max(0, totalEarned - totalWithdrawn),
      pending_balance: pendingBalance,
      total_earned: totalEarned,
      total_withdrawn: totalWithdrawn,
    })

    const creditTxns: Transaction[] =
      (completedOrders as OrderMoney[] | null)
        ?.filter((order) => {
          const ps = (order.payout_status || "").toLowerCase()
          return !["paid", "skipped_sim", "processing", "skipped_zero"].includes(ps)
        })
        .map((order, i) => ({
          id: `credit-${i}`,
          type: "credit" as const,
          amount: sellerNet(order),
          status: "completed" as const,
          description: "Vente libérée (Wallet)",
          reference: null,
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
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
          network: withdrawMethod.includes("mtn")
            ? "mtn"
            : withdrawMethod.includes("moov")
              ? "moov"
              : "orange",
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
      <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F5C2E]"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!isSellerRole(profile?.user_type)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24 px-4 pt-8">
        <h1 className="text-2xl font-bold text-[#1F5C2E]">Mon argent</h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Côté acheteur, suis tes commandes et confirme la réception. Les
          revenus vendeur ne s’affichent pas ici.
        </p>
        <div className="mt-6 space-y-3">
          <Link
            href="/dashboard/commandes"
            className="flex items-center justify-center rounded-full bg-[#1F5C2E] px-5 py-3 text-sm font-semibold text-white"
          >
            Voir mes commandes
          </Link>
          <Link
            href="/dashboard/buyer"
            className="flex items-center justify-center rounded-full border border-[#1F5C2E]/30 px-5 py-3 text-sm font-semibold text-[#1F5C2E]"
          >
            Mon espace acheteur
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24">
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <ProducerSubnav />
        <div className="mb-6">
          <h1 className="font-display text-3xl text-[#1F5C2E]">Mon argent</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Tes revenus et retraits Mobile Money, au même endroit.
          </p>
        </div>

        {/* Solde principal + argent gardé */}
        <div className="mb-4 rounded-2xl bg-[#1F5C2E] px-5 py-5 text-white shadow-sm">
          <p className="text-sm text-white/80">Disponible</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatAmount(wallet.balance)}</p>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#1F5C2E]/10 bg-white/90 px-4 py-3">
            <p className="text-xs text-[#6B7280]">Argent gardé</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
              {formatAmount(wallet.pending_balance)}
            </p>
            <p className="text-[11px] text-[#9CA3AF]">En cours de livraison</p>
          </div>
          <div className="rounded-2xl border border-[#1F5C2E]/10 bg-white/90 px-4 py-3">
            <p className="text-xs text-[#6B7280]">Total gagné</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
              {formatAmount(wallet.total_earned)}
            </p>
            <p className="text-[11px] text-[#9CA3AF]">
              Retiré {formatAmount(wallet.total_withdrawn)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="rounded-full bg-[#1F5C2E] hover:bg-[#184a25]"
            onClick={() => setShowWithdrawDialog(true)}
            disabled={wallet.balance < 1000}
          >
            <ArrowUpRight className="h-5 w-5 mr-2" />
            Retirer
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full border-[#1F5C2E]/25"
            onClick={loadWalletData}
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full border-[#1F5C2E]/25"
            onClick={() => router.push("/affacturage")}
          >
            <Building2 className="h-5 w-5 mr-2" />
            Avance sur vente
          </Button>
        </div>

        {wallet.balance < 1000 && (
          <div className="mb-6 rounded-2xl border border-[#1F5C2E]/15 bg-white/80 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#1F5C2E] mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-[#1F5C2E]">Minimum de retrait</p>
              <p className="text-sm text-[#6B7280]">
                Il te faut au moins 1&nbsp;000 FCFA disponibles pour retirer.
              </p>
            </div>
          </div>
        )}

        {/* Transactions */}
        <Tabs defaultValue="all">
          <TabsList className="bg-white/80 border border-[#E5E7EB] rounded-xl h-auto flex-wrap p-1">
            <TabsTrigger value="all" className="rounded-lg">Toutes</TabsTrigger>
            <TabsTrigger value="credits" className="rounded-lg">Entrées</TabsTrigger>
            <TabsTrigger value="withdrawals" className="rounded-lg">Retraits</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1F5C2E]/20 bg-white/60 px-6 py-14 text-center">
                <History className="h-12 w-12 mx-auto text-[#1F5C2E]/40 mb-4" />
                <h3 className="font-display text-lg text-[#1F5C2E]">Aucune transaction</h3>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Tes mouvements apparaîtront ici après tes premières ventes.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#1F5C2E]/10 bg-white/90 overflow-hidden">
                <div className="divide-y divide-[#F3F4F6]">
                  {transactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          txn.type === 'credit' ? 'bg-green-100' :
                          txn.type === 'withdrawal' ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div>
                          <p className="font-medium text-[#111827]">{txn.description}</p>
                          <p className="text-sm text-[#6B7280]">
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
              </div>
            )}
          </TabsContent>

          <TabsContent value="credits" className="mt-6">
            {transactions.filter(t => t.type === 'credit' || t.type === 'refund').length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1F5C2E]/20 bg-white/60 px-6 py-14 text-center">
                <p className="text-sm text-[#6B7280]">Pas encore d’entrée. Tes ventes apparaîtront ici.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#1F5C2E]/10 bg-white/90 overflow-hidden">
                <div className="divide-y divide-[#F3F4F6]">
                  {transactions.filter(t => t.type === 'credit' || t.type === 'refund').map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div>
                          <p className="font-medium">{txn.description}</p>
                          <p className="text-sm text-[#6B7280]">
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
              </div>
            )}
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-6">
            {transactions.filter(t => t.type === 'withdrawal').length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1F5C2E]/20 bg-white/60 px-6 py-14 text-center">
                <ArrowUpRight className="h-12 w-12 mx-auto text-[#1F5C2E]/40 mb-4" />
                <h3 className="font-display text-lg text-[#1F5C2E]">Aucun retrait</h3>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Tes retraits Mobile Money apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#1F5C2E]/10 bg-white/90 overflow-hidden">
                <div className="divide-y divide-[#F3F4F6]">
                  {transactions.filter(t => t.type === 'withdrawal').map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div>
                          <p className="font-medium">{txn.description}</p>
                          <p className="text-sm text-[#6B7280]">
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
              </div>
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
