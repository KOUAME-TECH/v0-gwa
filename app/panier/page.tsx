"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { 
  ShoppingCart, Trash2, Plus, Minus, MapPin, Truck, 
  CreditCard, Smartphone, Building2, ArrowRight, ChevronLeft,
  Package, Clock, X, CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { EscrowStepper } from "@/components/orders/escrow-stepper"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface CartItem {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    unit: string
    images: string[]
    product_type: string
    seller_id: string
    profiles: {
      full_name: string
      city: string
      country: string
    } | null
  }
}

const paymentMethods = [
  { id: "orange", name: "Orange Money", icon: Smartphone, color: "text-orange-500" },
  { id: "mtn", name: "MTN MoMo", icon: Smartphone, color: "text-yellow-500" },
  { id: "wave", name: "Wave", icon: Smartphone, color: "text-cyan-500" },
  { id: "moov", name: "Moov Money", icon: Smartphone, color: "text-blue-500" },
  { id: "bank", name: "Virement", icon: Building2, color: "text-gray-500" },
]

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [user, setUser] = useState<any>(null)
  const [deliveryAddress, setDeliveryAddress] = useState({
    name: "", phone: "", address: "", city: "", country: "ci"
  })
  const supabase = createClient()

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setLoading(false)
      return
    }

    setUser(user)

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, city, country")
      .eq("id", user.id)
      .single()

    if (profile) {
      setDeliveryAddress({
        name: profile.full_name || "",
        phone: profile.phone || "",
        address: "",
        city: profile.city || "",
        country: profile.country || "ci"
      })
    }

    const { data: cartItems } = await supabase
      .from("cart_items")
      .select(`
        id, quantity,
        product:product_id (
          id, name, price, unit, images, product_type, seller_id,
          profiles:seller_id (full_name, city, country)
        )
      `)
      .eq("user_id", user.id)

    if (cartItems) setCart(cartItems as any)
    setLoading(false)
  }

  const updateQuantity = async (itemId: string, delta: number) => {
    const item = cart.find(c => c.id === itemId)
    if (!item) return

    const newQuantity = Math.max(1, item.quantity + delta)
    
    await supabase.from("cart_items").update({ quantity: newQuantity }).eq("id", itemId)
    setCart(cart.map(c => c.id === itemId ? { ...c, quantity: newQuantity } : c))
  }

  const setQuantityExact = async (itemId: string, raw: string) => {
    const item = cart.find((c) => c.id === itemId)
    if (!item) return
    const parsed = Number.parseInt(raw.replace(/\D/g, ""), 10)
    if (!Number.isFinite(parsed)) return
    const newQuantity = Math.min(999_999, Math.max(1, parsed))
    await supabase.from("cart_items").update({ quantity: newQuantity }).eq("id", itemId)
    setCart(cart.map((c) => (c.id === itemId ? { ...c, quantity: newQuantity } : c)))
  }

  const removeItem = async (itemId: string) => {
    await supabase.from("cart_items").delete().eq("id", itemId)
    setCart(cart.filter(c => c.id !== itemId))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
  const deliveryFee = subtotal > 100000 ? 0 : 5000
  const serviceFee = Math.round(subtotal * 0.02)
  const total = subtotal + deliveryFee + serviceFee

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)

  const handleCheckout = async () => {
    if (step < 3) {
      setStep(step + 1)
      return
    }

    if (!user) {
      router.push("/auth/login?redirect=/panier")
      return
    }

    setIsProcessing(true)

    try {
      // Grouper les articles par vendeur : une commande par vendeur (marketplace)
      const itemsBySeller = new Map<string, CartItem[]>()
      for (const item of cart) {
        const sellerId = item.product.seller_id
        if (!sellerId) continue
        const existing = itemsBySeller.get(sellerId) || []
        existing.push(item)
        itemsBySeller.set(sellerId, existing)
      }

      if (itemsBySeller.size === 0) {
        throw new Error("Aucun vendeur valide dans le panier")
      }

      const createdOrderIds: string[] = []

      for (const [sellerId, items] of itemsBySeller) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seller_id: sellerId,
            payment_method: paymentMethod,
            shipping_address: deliveryAddress.address || deliveryAddress.name,
            shipping_city: deliveryAddress.city,
            shipping_country: deliveryAddress.country,
            shipping_phone: deliveryAddress.phone,
            items: items.map((item) => ({
              product_id: item.product.id,
              quantity: item.quantity,
            })),
          }),
        })

        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(payload?.error || "Création commande échouée")
        }

        const orderId = payload?.order?.id as string | undefined
        if (!orderId) throw new Error("Réponse commande invalide")
        createdOrderIds.push(orderId)

        // Paiement : live Feexpay ou simulation hors prod uniquement
        const payRes = await fetch(`/api/orders/${orderId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_method: paymentMethod }),
        })
        if (!payRes.ok && payRes.status !== 503) {
          const payErr = await payRes.json().catch(() => ({}))
          console.error("[panier] pay", payErr)
        }
      }

      // Vider le panier une fois toutes les commandes creees
      await supabase.from("cart_items").delete().eq("user_id", user.id)

      router.push(`/commandes/confirmation?order=${createdOrderIds[0]}`)
    } catch (err) {
      console.log("[v0] Checkout error:", err)
      setCheckoutError(
        "Une erreur est survenue lors de la commande. Reessayez.",
      )
      setIsProcessing(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return cart.length > 0
    if (step === 2) return deliveryAddress.name && deliveryAddress.phone && deliveryAddress.city
    if (step === 3) return paymentMethod
    return false
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Connectez-vous</h2>
        <p className="text-muted-foreground text-sm text-center mb-6 max-w-xs">
          Pour voir votre panier, vous devez être connecté
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/auth/login?redirect=/panier">
            <Button className="w-full h-12 rounded-xl">Se connecter</Button>
          </Link>
          <Link href="/auth/signup">
            <Button variant="outline" className="w-full h-12 rounded-xl bg-transparent">Créer un compte</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">Panier vide</h2>
        <p className="text-muted-foreground text-sm text-center mb-6 max-w-xs">
          Explorez nos produits agricoles
        </p>
        <div className="flex gap-3">
          <Link href="/agriculture">
            <Button className="rounded-xl">Agriculture</Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="outline" className="rounded-xl bg-transparent">Marketplace</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            <Link href="/">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          )}
          <h1 className="text-lg font-semibold flex-1">
            {step === 1 && `Panier (${cart.length})`}
            {step === 2 && "Livraison"}
            {step === 3 && "Paiement"}
          </h1>
        </div>
        
        {/* Progress */}
        <div className="flex gap-1 px-4 pb-3">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </header>

      {/* Step 1: Cart Items */}
      {step === 1 && (
        <div className="p-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex gap-3 bg-card rounded-2xl p-3 border border-border">
              <div className="w-20 h-20 relative rounded-xl overflow-hidden bg-muted shrink-0">
                {item.product.images?.[0] ? (
                  <Image 
                    src={item.product.images[0] || "/placeholder.svg"} 
                    alt={item.product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm line-clamp-2">{item.product.name}</h3>
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.product.profiles?.full_name}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
                      aria-label="Diminuer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={999999}
                      value={item.quantity}
                      onChange={(e) => setQuantityExact(item.id, e.target.value)}
                      className="w-12 h-7 text-center text-sm font-medium rounded-lg border border-border bg-background tabular-nums"
                      aria-label="Quantité"
                    />
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
                      aria-label="Augmenter"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="font-bold text-primary">
                    {formatPrice(item.product.price * item.quantity)} <span className="text-xs font-normal">FCFA</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Delivery */}
      {step === 2 && (
        <div className="p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Nom complet</Label>
              <Input
                value={deliveryAddress.name}
                onChange={(e) => setDeliveryAddress({...deliveryAddress, name: e.target.value})}
                className="mt-1.5 h-12 rounded-xl"
                placeholder="Votre nom"
              />
            </div>
            <div>
              <Label className="text-sm">Telephone</Label>
              <Input
                type="tel"
                value={deliveryAddress.phone}
                onChange={(e) => setDeliveryAddress({...deliveryAddress, phone: e.target.value})}
                className="mt-1.5 h-12 rounded-xl"
                placeholder="+225 XX XX XX XX"
              />
            </div>
            <div>
              <Label className="text-sm">Adresse</Label>
              <Input
                value={deliveryAddress.address}
                onChange={(e) => setDeliveryAddress({...deliveryAddress, address: e.target.value})}
                className="mt-1.5 h-12 rounded-xl"
                placeholder="Rue, quartier, reperes..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Ville</Label>
                <Input
                  value={deliveryAddress.city}
                  onChange={(e) => setDeliveryAddress({...deliveryAddress, city: e.target.value})}
                  className="mt-1.5 h-12 rounded-xl"
                  placeholder="Abidjan"
                />
              </div>
              <div>
                <Label className="text-sm">Pays</Label>
                <select 
                  value={deliveryAddress.country}
                  onChange={(e) => setDeliveryAddress({...deliveryAddress, country: e.target.value})}
                  className="mt-1.5 w-full h-12 px-3 rounded-xl border bg-background text-sm"
                >
                  <option value="ci">Côte d{"'"}Ivoire</option>
                  <option value="sn">Senegal</option>
                  <option value="cm">Cameroun</option>
                  <option value="ml">Mali</option>
                  <option value="bf">Burkina Faso</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-muted rounded-2xl">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">Delai estime</p>
              <p className="text-xs text-muted-foreground">3-7 jours ouvrables</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 3 && (
        <div className="p-4 space-y-3">
          <EscrowStepper payment_status="pending" escrow_status="pending" status="pending" />
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
            {paymentMethods.map(method => (
              <div 
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors cursor-pointer ${
                  paymentMethod === method.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem value={method.id} id={method.id} />
                <method.icon className={`h-6 w-6 ${method.color}`} />
                <Label htmlFor={method.id} className="flex-1 cursor-pointer font-medium">
                  {method.name}
                </Label>
                {method.id !== "bank" && (
                  <Badge variant="outline" className="text-[10px]">Instant</Badge>
                )}
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Fixed Bottom Summary */}
      <div className="fixed bottom-[76px] left-0 right-0 bg-background border-t border-border p-4 pb-4 space-y-3 z-40">
        {checkoutError && (
          <p className="text-sm text-destructive text-center">{checkoutError}</p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatPrice(subtotal)} FCFA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Livraison</span>
            <span>{deliveryFee === 0 ? "Gratuit" : `${formatPrice(deliveryFee)} FCFA`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frais service (2%)</span>
            <span>{formatPrice(serviceFee)} FCFA</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">{formatPrice(total)} FCFA</span>
          </div>
        </div>
        
        <Button 
          onClick={handleCheckout}
          disabled={!canProceed() || isProcessing}
          className="w-full h-14 rounded-2xl text-base font-semibold"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {step < 3 ? "Continuer" : "Payer maintenant"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
