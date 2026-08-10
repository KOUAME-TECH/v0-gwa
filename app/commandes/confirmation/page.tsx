"use client"

import { useEffect, useState, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Package, Truck, MapPin, Clock, ArrowRight, Loader2, Home } from 'lucide-react'
import Link from "next/link"
import { EscrowStepper } from "@/components/orders/escrow-stepper"
import { LocationMapCard } from "@/components/location/location-map-card"

interface Order {
  id: string
  order_number: string
  total_amount: number
  status: string
  shipping_address: string
  shipping_city: string
  shipping_country: string
  payment_method: string
  payment_status: string
  escrow_status?: string | null
  created_at: string
  estimated_delivery: string | null
  order_items: {
    quantity: number
    unit_price: number
    products: {
      name: string
      unit: string
    }
  }[]
  profiles: {
    full_name: string
    phone: string
  }
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')
  const pendingFlag = searchParams.get('pending')
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [deliveryMap, setDeliveryMap] = useState<{
    lat: number
    lon: number
    address?: string | null
    city?: string | null
    country?: string | null
  } | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    if (orderId) {
      loadOrder(orderId)
    } else {
      setLoading(false)
    }
  }, [orderId])

  // Poll paiement USSD / processing jusqu'à paid|failed
  useEffect(() => {
    if (!orderId || !order) return
    const needsPoll =
      order.payment_status === "processing" ||
      pendingFlag === "1" ||
      pendingFlag === "ussd"
    if (!needsPoll || order.payment_status === "paid") return

    setPolling(true)
    let cancelled = false
    let ticks = 0
    const timer = setInterval(() => {
      ticks += 1
      void fetch(`/api/orders/${orderId}/payment-status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return
          if (
            data.payment_status === "paid" ||
            data.payment_status === "failed"
          ) {
            void loadOrder(orderId)
            setPolling(false)
            clearInterval(timer)
          }
        })
        .catch(() => undefined)
      if (ticks >= 40) {
        // ~2 min
        setPolling(false)
        clearInterval(timer)
      }
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(timer)
      setPolling(false)
    }
  }, [orderId, order?.payment_status, pendingFlag])

  useEffect(() => {
    if (!order) {
      setDeliveryMap(null)
      return
    }
    const q = [
      order.shipping_address,
      order.shipping_city,
      order.shipping_country,
    ]
      .filter(Boolean)
      .join(", ")
      .trim()
    if (!q) return

    let cancelled = false
    void fetch(`/api/geocode/forward?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.lat || !data?.lon) return
        setDeliveryMap({
          lat: Number(data.lat),
          lon: Number(data.lon),
          address: data.address || q,
          city: data.city || order.shipping_city,
          country: data.country || order.shipping_country,
        })
      })
      .catch(() => {
        /* carte optionnelle */
      })
    return () => {
      cancelled = true
    }
  }, [order])

  async function loadOrder(id: string) {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          products (
            name,
            unit
          )
        ),
        profiles:buyer_id (
          full_name,
          phone
        )
      `)
      .eq('id', id)
      .single()

    if (data) {
      setOrder(data)
    }
    setLoading(false)
  }

  const orderStatuses = [
    { status: "pending", label: "Commande reçue", icon: CheckCircle2, completed: true },
    { status: "confirmed", label: "Payée", icon: Package, completed: ["confirmed", "processing", "shipped", "delivered"].includes(order?.status || "") },
    { status: "shipped", label: "En livraison", icon: Truck, completed: order?.status === "shipped" || order?.status === "delivered" },
    { status: "delivered", label: "Livrée", icon: MapPin, completed: order?.status === "delivered" },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  // If no order found or no order ID
  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Commande introuvable</h1>
            <p className="text-muted-foreground mb-8">
              Vérifie le lien ou ouvre tes commandes depuis le tableau de bord.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" asChild>
                <Link href="/dashboard/commandes">
                  <Package className="mr-2 h-4 w-4" />
                  Voir mes commandes
                </Link>
              </Button>
              <Button asChild>
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Retour à l{"'"}accueil
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const paymentPending =
    order.payment_status === "processing" ||
    order.payment_status === "pending"
  const paymentFailed = order.payment_status === "failed"
  const paymentOk =
    order.payment_status === "paid" || order.escrow_status === "held"

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Status Message */}
          <div className="text-center mb-8">
            <div
              className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                paymentFailed
                  ? "bg-destructive/10"
                  : paymentPending
                    ? "bg-amber-500/10"
                    : "bg-primary/10"
              }`}
            >
              {paymentPending || polling ? (
                <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
              ) : (
                <CheckCircle2
                  className={`h-10 w-10 ${
                    paymentFailed ? "text-destructive" : "text-primary"
                  }`}
                />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {paymentFailed
                ? "Paiement échoué"
                : paymentPending
                  ? "En attente de validation Mobile Money"
                  : "Paiement reçu"}
            </h1>
            <p className="text-muted-foreground">
              {paymentFailed
                ? "Le paiement n’a pas abouti. Réessaie depuis tes commandes."
                : paymentPending
                  ? "Valide sur ton téléphone (USSD / push). Cette page se met à jour automatiquement."
                  : "Ton argent est protégé : le vendeur est payé après que tu confirmes la réception."}
            </p>
          </div>

          <div className="mb-6">
            <EscrowStepper
              payment_status={order.payment_status}
              escrow_status={order.escrow_status as never}
              status={order.status}
            />
          </div>

          {/* Order Details Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Numéro de commande</p>
                  <p className="font-mono font-bold">{order.order_number || `GWA-${order.id.slice(0, 8).toUpperCase()}`}</p>
                </div>
                <Badge variant="secondary">
                  {order.status === 'pending' ? 'En attente' : 
                   order.status === 'confirmed' ? 'Confirmée' :
                   order.status === 'shipped' ? 'Expédiée' : 
                   order.status === 'delivered' ? 'Livrée' : order.status}
                </Badge>
              </div>

              {/* Order Status Timeline */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  {orderStatuses.map((s, i) => (
                    <div key={s.status} className="flex flex-col items-center flex-1">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        s.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <s.icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-2 text-center">{s.label}</span>
                      {i < orderStatuses.length - 1 && (
                        <div className={`h-0.5 w-full absolute top-5 left-1/2 ${
                          s.completed ? "bg-primary" : "bg-muted"
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-3 mb-6">
                <h3 className="font-medium">Articles commandés</h3>
                {order.order_items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{item.products?.name || 'Produit'}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.products?.unit || 'unité'}(s)
                      </p>
                    </div>
                    <p className="font-medium">{(item.quantity * item.unit_price).toLocaleString()} FCFA</p>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg mb-6">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold text-primary">{order.total_amount.toLocaleString()} FCFA</span>
              </div>

              {/* Delivery Info + carte (uniquement après commande validée) */}
              <div className="space-y-3">
                <h3 className="font-medium">Livraison</h3>
                {deliveryMap ? (
                  <LocationMapCard
                    lat={deliveryMap.lat}
                    lon={deliveryMap.lon}
                    address={deliveryMap.address}
                    city={deliveryMap.city}
                    country={deliveryMap.country}
                    height={200}
                  />
                ) : (
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {order.shipping_address}
                        {order.shipping_city && `, ${order.shipping_city}`}
                        {order.shipping_country && `, ${order.shipping_country}`}
                      </span>
                    </div>
                  </div>
                )}
                {order.estimated_delivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Livraison estimée : {order.estimated_delivery}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 bg-transparent" asChild>
              <Link href="/dashboard/commandes">
                Voir mes commandes
              </Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/">
                Continuer mes achats
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
