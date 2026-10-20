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
  const paymentUnavailable = searchParams.get('payment') === "unavailable"
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
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

  useEffect(() => {
    if (
      !orderId ||
      paymentUnavailable ||
      order?.payment_method !== "geniuspay" ||
      order.payment_status === "paid"
    ) return
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const checkPayment = async () => {
      if (cancelled || attempts >= 6) return
      attempts += 1
      setVerifyingPayment(true)
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/verify-payment`, {
          method: "POST",
        })
        const result = await response.json().catch(() => ({}))
        if (!cancelled && (result.status === "paid" || result.status === "failed")) {
          await loadOrder(orderId)
          setVerifyingPayment(false)
          return
        }
      } catch {
        /* la vérification pourra être relancée manuellement */
      }
      if (!cancelled) {
        setVerifyingPayment(false)
        timer = setTimeout(checkPayment, 5000)
      }
    }

    timer = setTimeout(checkPayment, 1500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [orderId, order?.payment_method, order?.payment_status, paymentUnavailable])

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
    { status: "confirmed", label: "Confirmée", icon: Package, completed: ["confirmed", "processing", "shipped", "delivered"].includes(order?.status || "") },
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

  // If no order found or no order ID, show a generic success
  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Commande Confirmée !</h1>
            <p className="text-muted-foreground mb-8">
              Merci pour votre commande. Vous recevrez un SMS de confirmation sous peu.
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

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {order.payment_status === "paid" ? "Paiement confirmé" : "Commande créée"}
            </h1>
            <p className="text-muted-foreground">
              {order.payment_status === "paid"
                ? "Ton paiement est protégé : le vendeur touche l’argent après confirmation de livraison."
                : order.payment_status === "failed"
                  ? "Le paiement n’a pas abouti. Tu peux réessayer depuis tes commandes."
                  : paymentUnavailable
                    ? "Commande créée, mais le paiement n’a pas pu démarrer. Consulte tes commandes avant de réessayer."
                    : "Le retour du checkout ne confirme pas le paiement. GeniusPay vérifie la transaction côté serveur."}
            </p>
            {order.payment_method === "geniuspay" &&
              order.payment_status !== "paid" &&
              !paymentUnavailable && (
              <Button
                className="mt-4"
                variant="outline"
                disabled={verifyingPayment}
                onClick={async () => {
                  if (!orderId) return
                  setVerifyingPayment(true)
                  try {
                    const response = await fetch(
                      `/api/orders/${encodeURIComponent(orderId)}/verify-payment`,
                      { method: "POST" },
                    )
                    const result = await response.json().catch(() => ({}))
                    if (response.ok && (result.status === "paid" || result.status === "failed")) {
                      await loadOrder(orderId)
                    }
                  } finally {
                    setVerifyingPayment(false)
                  }
                }}
              >
                {verifyingPayment ? "Vérification…" : "Vérifier le paiement"}
              </Button>
            )}
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
