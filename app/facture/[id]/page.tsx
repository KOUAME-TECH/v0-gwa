"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"

interface OrderItem {
  quantity: number
  unit_price: number
  total_price: number
  product_id: string
}

interface InvoicePayload {
  invoice: {
    id: string
    number: string
    total_fcfa: number
    issued_at: string
  }
  order: {
    order_number: string
    subtotal: number
    shipping_cost: number
    service_fee: number
    total_amount: number
    shipping_city: string | null
    shipping_country: string | null
    created_at: string
    order_items: OrderItem[]
  } | null
  buyer: { full_name: string | null; city: string | null; country: string | null; phone: string | null } | null
  seller: { full_name: string | null; city: string | null; country: string | null; phone: string | null } | null
}

function fcfa(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)) + " FCFA"
}

export default function FacturePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<InvoicePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/invoices/${params.id}`)
      if (res.status === 401) {
        router.replace(`/auth/login?redirect=/facture/${params.id}`)
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || "Facture introuvable")
      } else {
        setData(json)
      }
      setLoading(false)
    }
    void load()
  }, [params.id, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-muted-foreground">{error || "Facture introuvable"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>
    )
  }

  const { invoice, order, buyer, seller } = data

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer / PDF
        </Button>
      </div>

      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 print:shadow-none print:p-0">
        <div className="flex items-start justify-between border-b pb-6 mb-6">
          <div>
            <div className="text-2xl font-bold text-[#2F7D32]">GWA</div>
            <p className="text-sm text-muted-foreground">Grand Warè Africa — Agriculture</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold">FACTURE</h1>
            <p className="text-sm font-mono">{invoice.number}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(invoice.issued_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
          <div>
            <p className="font-semibold text-muted-foreground mb-1">Vendeur</p>
            <p className="font-medium">{seller?.full_name || "—"}</p>
            <p className="text-muted-foreground">
              {[seller?.city, seller?.country].filter(Boolean).join(", ")}
            </p>
            {seller?.phone && <p className="text-muted-foreground">{seller.phone}</p>}
          </div>
          <div>
            <p className="font-semibold text-muted-foreground mb-1">Acheteur</p>
            <p className="font-medium">{buyer?.full_name || "—"}</p>
            <p className="text-muted-foreground">
              {[buyer?.city, buyer?.country].filter(Boolean).join(", ")}
            </p>
            {buyer?.phone && <p className="text-muted-foreground">{buyer.phone}</p>}
          </div>
        </div>

        {order && (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              Commande <span className="font-mono">{order.order_number}</span>
            </p>
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Article</th>
                  <th className="py-2 text-right">Qté</th>
                  <th className="py-2 text-right">P.U.</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((item, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">Produit {i + 1}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{fcfa(item.unit_price)}</td>
                    <td className="py-2 text-right">{fcfa(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto w-full max-w-xs text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total</span>
                <span>{fcfa(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Livraison</span>
                <span>{fcfa(order.shipping_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais de service</span>
                <span>{fcfa(order.service_fee)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Total</span>
                <span>{fcfa(invoice.total_fcfa || order.total_amount)}</span>
              </div>
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-10 border-t pt-4">
          Facture générée automatiquement par GWA après confirmation de réception.
          Montants en francs CFA (FCFA). Document non fiscal — usage interne bêta.
        </p>
      </div>
    </div>
  )
}
