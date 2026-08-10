"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Package,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ProducerSubnav } from "@/components/producer/producer-subnav"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  unit: string
  stock_quantity: number
  images: string[] | null
  status: string
  views_count: number | null
  created_at: string
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notAuthed, setNotAuthed] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotAuthed(true)
        setIsLoading(false)
        return
      }

      // Ne sélectionner que des colonnes existantes ; exclure les archivés (soft-delete)
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, description, price, unit, stock_quantity, images, status, views_count, created_at",
        )
        .eq("seller_id", user.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[dashboard/products]", error.message)
        toast.error("Impossible de charger vos produits")
      } else if (data) {
        setProducts(data as Product[])
      }
      setIsLoading(false)
    }

    fetchProducts()
  }, [])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${pendingDelete.id}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Suppression impossible")
      setProducts((prev) => prev.filter((p) => p.id !== pendingDelete.id))
      toast.success("Produit supprimé")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  const toggleActive = async (product: Product) => {
    const newStatus = product.status === "active" ? "inactive" : "active"
    // MàJ optimiste
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p)),
    )
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success(newStatus === "active" ? "Produit activé" : "Produit désactivé")
    } catch {
      // rollback
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: product.status } : p)),
      )
      toast.error("Erreur de mise à jour")
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-dvh bg-[#FFF6E5]">
      {/* Header mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] safe-top">
        <div className="flex items-center gap-2 h-14 px-3">
          <Link
            href="/dashboard/farmer"
            className="p-2 -ml-1 rounded-full active:bg-neutral-100"
            aria-label="Retour espace producteur"
          >
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#111827] flex-1">Mes produits</h1>
          <Link
            href="/publier"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#2F7D32] text-white text-sm font-medium active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <ProducerSubnav />
        {/* Recherche */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Rechercher un produit..."
            className="pl-10 h-11 rounded-xl bg-white border-[#E5E7EB]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-[#2F7D32]" />
          </div>
        ) : notAuthed ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-12 w-12 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">Connectez-vous</h3>
            <p className="text-neutral-500 text-sm mb-5">
              pour gérer vos produits en vente
            </p>
            <Link
              href="/auth/login?redirect=/dashboard/products"
              className="h-11 px-8 rounded-full bg-[#2F7D32] text-white font-medium inline-flex items-center"
            >
              Se connecter
            </Link>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl">
            <Package className="h-12 w-12 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">Pas encore d’annonce</h3>
            <p className="text-neutral-500 text-sm mb-5 px-6">
              {searchQuery
                ? "Aucun produit ne correspond à ta recherche"
                : "Ajoute ton premier produit pour le vendre."}
            </p>
            {!searchQuery && (
              <Link
                href="/publier"
                className="h-11 px-6 rounded-full bg-[#1F5C2E] text-white font-medium inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un produit
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm flex"
              >
                <Link
                  href={`/produit/${product.id}`}
                  className="relative w-24 h-24 flex-shrink-0 bg-neutral-100"
                >
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package className="h-8 w-8 text-neutral-300" />
                    </div>
                  )}
                  <span
                    className={`absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white ${
                      product.status === "active" ? "bg-[#2F7D32]" : "bg-neutral-400"
                    }`}
                  >
                    {product.status === "active" ? "Actif" : "Inactif"}
                  </span>
                </Link>

                <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/produit/${product.id}`} className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[15px] text-[#111827] line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                        {product.description || "Pas de description"}
                      </p>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="p-1.5 -mr-1 -mt-1 rounded-full active:bg-neutral-100"
                        aria-label="Options"
                      >
                        <MoreVertical className="h-4 w-4 text-neutral-500" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/products/${product.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(product)}>
                          {product.status === "active" ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Désactiver
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Activer
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setPendingDelete(product)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-[#2F7D32] text-sm">
                      {product.price.toLocaleString("fr-FR")} FCFA
                      <span className="text-neutral-400 font-normal">/{product.unit}</span>
                    </span>
                    <span className="text-xs text-neutral-400">
                      Stock {product.stock_quantity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingDelete?.name} » sera retiré de la vente et n'apparaîtra plus
              sur le marketplace. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
