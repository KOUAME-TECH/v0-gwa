"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { DisplayedProfile } from "@/lib/profile/self"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { WALLET_FLAG } from "@/lib/feature-flags/core"
import { SCG_EXPLANATION, SCG_TIPS, scgLevel } from "@/lib/scg/explain"
import { clampScg, formatScg, scgRatio, SCG_MAX } from "@/lib/scg/scale"
import {
  Settings,
  LogOut,
  ChevronRight,
  Package,
  Heart,
  ShoppingBag,
  MessageCircle,
  MapPin,
  BadgeCheck,
  Bell,
  HelpCircle,
  Star,
  Shield,
  Download,
  TrendingUp,
  FileText,
  ShieldCheck,
  Crown,
  LayoutDashboard,
  Pencil,
  Wallet,
} from "lucide-react"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"
import { dashboardPathForUserType, isSellerRole } from "@/lib/dashboard/routing"
import {
  isDualIdentity,
  productEspaceLabel,
} from "@/lib/auth/dual-identity"
type MenuItem = {
  icon: typeof Package
  label: string
  href: string
  count?: number
  highlight?: boolean
}

const APP_VERSION = "1.0.0"

type RecentOrder = {
  id: string
  order_number: string | null
  total_amount: number | null
  status: string | null
  created_at: string
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  pending_payment: "Paiement en attente",
  paid: "Payée",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  completed: "Terminée",
  cancelled: "Annulée",
  disputed: "Litige",
  refunded: "Remboursée",
}

export default function ProfilScreen({
  profile,
  partial,
}: {
  profile: DisplayedProfile
  partial: boolean
}) {
  const router = useRouter()
  const [stats, setStats] = useState({ products: 0, orders: 0, favorites: 0 })
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRoleLabel, setAdminRoleLabel] = useState<string | null>(null)
  const [scgScore, setScgScore] = useState<number | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const walletEnabled = useFeatureFlag(WALLET_FLAG)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const userId = profile.id

    const loadStats = async () => {
      try {
        const [productsRes, ordersRes, favoritesRes, adminRes, notifRes, msgRes, scgRes, recentRes] =
          await Promise.all([
            supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("seller_id", userId),
            supabase
              .from("orders")
              .select("id", { count: "exact", head: true })
              .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
            supabase
              .from("favorites")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId),
            supabase
              .from("admin_roles")
              .select("role")
              .eq("user_id", userId)
              .eq("is_active", true)
              .maybeSingle(),
            supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("is_read", false),
            supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("is_read", false)
              .neq("sender_id", userId),
            supabase
              .from("scg_scores")
              .select("score_total")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("orders")
              .select("id, order_number, total_amount, status, created_at")
              .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
              .order("created_at", { ascending: false })
              .limit(5),
          ])

        if (!mounted) return

        setIsAdmin(!!adminRes.data)
        setAdminRoleLabel(
          adminRes.data?.role
            ? String(adminRes.data.role).replace(/_/g, " ")
            : null,
        )
        setScgScore(typeof scgRes.data?.score_total === "number" ? scgRes.data.score_total : null)
        setRecentOrders((recentRes.data || []) as RecentOrder[])
        setUnreadNotifs(notifRes.count || 0)
        setUnreadMsgs(msgRes.count || 0)
        setStats({
          products: productsRes.count || 0,
          orders: ordersRes.count || 0,
          favorites: favoritesRes.count || 0,
        })
      } catch {
        // Le nom vient du serveur. Un compteur en échec ne déconnecte pas.
      }
    }

    void loadStats()
    return () => {
      mounted = false
    }
  }, [profile.id])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    const supabase = createClient()
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      await supabase.auth.signOut()
      router.replace("/auth/login")
      router.refresh()
    } catch {
      await supabase.auth.signOut()
      router.replace("/auth/login")
    }
  }

  const getUserTypeLabel = (type: string | null) => {
    const types: Record<string, string> = {
      producteur: "Producteur",
      farmer: "Producteur",
      transformateur: "Transformateur",
      acheteur: "Acheteur",
      buyer: "Acheteur",
      cooperative: "Coopérative",
      entreprise: "Entreprise",
    }
    return type ? types[type] || type : "Membre"
  }

  const isSeller = isSellerRole(profile.user_type)
  const isCooperative = profile.user_type === "cooperative"
  const roleHome = dashboardPathForUserType(profile.user_type)
  const dual = isDualIdentity(isAdmin, profile.user_type)

  const getMainMenuItems = (): MenuItem[] => {
    const espaceLabel = productEspaceLabel(profile.user_type)

    const espace: MenuItem = {
      icon: LayoutDashboard,
      label: espaceLabel,
      href: roleHome,
    }

    if (isCooperative) {
      return [
        espace,
        {
          icon: Package,
          label: "Catalogue / produits",
          href: "/dashboard/products",
          count: stats.products,
        },
        {
          icon: ShoppingBag,
          label: "Mes ventes",
          href: "/dashboard/commandes",
          count: stats.orders,
        },
        { icon: Crown, label: "Abonnement", href: "/abonnement" },
      ]
    }

    if (isSeller) {
      return [
        espace,
        {
          icon: Package,
          label: "Mes produits",
          href: "/dashboard/products",
          count: stats.products,
        },
        {
          icon: ShoppingBag,
          label: "Mes ventes",
          href: "/dashboard/commandes",
          count: stats.orders,
        },
        { icon: Crown, label: "Abonnement", href: "/abonnement" },
        { icon: Star, label: "Mes avis", href: "/dashboard/reviews" },
      ]
    }

    return [
      espace,
      {
        icon: ShoppingBag,
        label: "Mes commandes",
        href: "/dashboard/commandes",
        count: stats.orders,
      },
      {
        icon: Heart,
        label: "Favoris",
        href: "/favoris",
        count: stats.favorites,
      },
    ]
  }

  const menuSections: { title?: string; items: MenuItem[] }[] = [
    {
      title: "Compte GWA",
      items: getMainMenuItems(),
    },
    ...(isAdmin
      ? [
          {
            title: dual ? "Backoffice (séparé)" : "Administration",
            items: [
              {
                icon: Shield,
                label: dual
                  ? `Backoffice admin${adminRoleLabel ? ` · ${adminRoleLabel}` : ""}`
                  : "Backoffice admin",
                href: "/admin",
                highlight: true,
              },
            ],
          },
        ]
      : []),
    ...(isSeller || isCooperative
      ? [
          {
            items: [
              {
                icon: TrendingUp,
                label: "Score de Confiance GWA",
                href: "/scg",
                highlight: true,
              },
            ],
          },
        ]
      : []),
    {
      items: [
        {
          icon: MessageCircle,
          label: "Messages",
          href: "/messages",
          count: unreadMsgs,
        },
        {
          icon: Bell,
          label: "Notifications",
          href: "/notifications",
          count: unreadNotifs,
        },
      ],
    },
    {
      items: [
        { icon: Settings, label: "Paramètres", href: "/profil/edit" },
        { icon: Download, label: "Installer l'app", href: "/download" },
        { icon: HelpCircle, label: "Aide", href: "/aide" },
        { icon: FileText, label: "Contact", href: "/contact" },
      ],
    },
    {
      items: [
        { icon: FileText, label: "Conditions d'utilisation", href: "/conditions" },
        {
          icon: ShieldCheck,
          label: "Politique de confidentialité",
          href: "/confidentialite",
        },
      ],
    },
  ]

  const accountSections = menuSections.filter(
    (sec) => !sec.items.some((i) => i.href === "/profil/edit" || i.href === "/conditions"),
  )
  const settingsSections = menuSections.filter((sec) =>
    sec.items.some((i) => i.href === "/profil/edit" || i.href === "/conditions"),
  )
  const level = scgLevel(scgScore)
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)

  const renderSections = (sections: typeof menuSections) =>
    sections.map((section, idx) => (
      <div key={idx} className="space-y-1.5">
        {section.title ? (
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {section.title}
          </p>
        ) : null}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {section.items.map((item, itemIdx) => (
            <Link key={item.label} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3.5 active:bg-neutral-50 ${
                  itemIdx !== section.items.length - 1 ? "border-b border-neutral-100" : ""
                } ${item.highlight ? "bg-[#2F7D32]/5" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    item.highlight ? "bg-[#2F7D32]" : "bg-neutral-100"
                  }`}
                >
                  <item.icon
                    className={`h-[18px] w-[18px] ${item.highlight ? "text-white" : "text-neutral-600"}`}
                  />
                </div>
                <span className="flex-1 font-medium text-[15px]">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="min-w-6 h-6 px-1.5 rounded-full bg-neutral-900 text-white text-xs font-semibold flex items-center justify-center">
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                )}
                <ChevronRight className="h-5 w-5 text-neutral-300" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    ))

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="gwa-shell-page lg:py-6">
        <header className="bg-white px-5 pt-4 pb-5 lg:rounded-2xl lg:shadow-sm">
          <h1 className="text-xl font-semibold mb-5">Moi</h1>

          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-4 ring-neutral-100">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-neutral-900 text-white text-xl font-medium">
                {profile.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h2 className="text-lg font-semibold truncate" data-testid="profile-name">
                  {profile.full_name || "Utilisateur GWA"}
                </h2>
                {shouldShowVerifiedBadge(profile) && (
                  <BadgeCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" aria-label="Vérifié" />
                )}
              </div>
              <p className="text-sm text-neutral-500">
                {getUserTypeLabel(profile.user_type)}
                {dual ? " · aussi admin backoffice" : ""}
              </p>
              {(profile.city || profile.country) && (
                <div className="flex items-center gap-1 text-sm text-neutral-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  <span>{[profile.city, profile.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>
            <Link
              href="/profil/edit"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2F7D32] px-4 h-10 text-sm font-semibold text-white active:opacity-80"
              data-testid="profile-edit"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Modifier
            </Link>
          </div>

          {partial ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              <p>Certaines informations du profil n&apos;ont pas pu être lues.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-1 font-medium text-[#1F5C2E] underline"
              >
                Réessayer
              </button>
            </div>
          ) : null}
        </header>

        <Tabs defaultValue="infos" className="px-5 pt-4">
          <TabsList
            className={`grid w-full ${walletEnabled ? "grid-cols-4" : "grid-cols-3"} h-11 rounded-full bg-white shadow-sm`}
            aria-label="Sections du profil"
          >
            <TabsTrigger value="infos" className="rounded-full text-[13px]">Infos</TabsTrigger>
            <TabsTrigger value="commandes" className="rounded-full text-[13px]">Commandes</TabsTrigger>
            {walletEnabled ? (
              <TabsTrigger value="portefeuille" className="rounded-full text-[13px]">Portefeuille</TabsTrigger>
            ) : null}
            <TabsTrigger value="parametres" className="rounded-full text-[13px]">Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="infos" className="space-y-4 pt-4">
            <section className="bg-white rounded-2xl p-4 shadow-sm" aria-labelledby="scg-title" data-testid="scg-card">
              <div className="flex items-center justify-between gap-3">
                <h3 id="scg-title" className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#2F7D32]" aria-hidden />
                  Score de Confiance
                </h3>
                {level ? (
                  <span className="text-sm font-semibold text-[#2F7D32]">
                    {formatScg(scgScore)} · {level.label}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">Pas encore calculé</span>
                )}
              </div>
              {level ? (
                <div
                  className="mt-3 h-2 rounded-full bg-neutral-100 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={SCG_MAX}
                  aria-valuenow={clampScg(scgScore)}
                  aria-valuetext={formatScg(scgScore)}
                  aria-label="Score de Confiance"
                >
                  <div className="h-full bg-[#2F7D32]" style={{ width: `${scgRatio(scgScore) * 100}%` }} />
                </div>
              ) : null}
              <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                {level ? `${level.sentence} ` : ""}
                {SCG_EXPLANATION}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {SCG_TIPS.map((t) => (
                  <li key={t} className="text-[11px] rounded-full bg-[#2F7D32]/10 text-[#1F5C2E] px-2 py-1">
                    {t}
                  </li>
                ))}
              </ul>
            </section>

            {profile.bio ? (
              <p className="bg-white rounded-2xl p-4 shadow-sm text-sm text-neutral-600 leading-relaxed">{profile.bio}</p>
            ) : null}

            {dual ? (
              <div className="rounded-xl border border-[#1F5C2E]/20 bg-[#1F5C2E]/5 px-3 py-2.5 text-sm text-[#1F5C2E]">
                <p className="font-medium">Double identité</p>
                <p className="text-xs text-[#1F5C2E]/80 mt-0.5 leading-relaxed">
                  Votre espace {getUserTypeLabel(profile.user_type).toLowerCase()} et le backoffice sont séparés.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              {(isSeller
                ? [
                    { label: "Produits", value: stats.products },
                    { label: "Ventes", value: stats.orders },
                    { label: "Favoris", value: stats.favorites },
                  ]
                : [
                    { label: "Commandes", value: stats.orders },
                    { label: "Favoris", value: stats.favorites },
                    { label: "Produits", value: stats.products },
                  ]
              ).map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-xl font-bold text-neutral-900">{stat.value}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {renderSections(accountSections)}
          </TabsContent>

          <TabsContent value="commandes" className="space-y-3 pt-4">
            {recentOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                <ShoppingBag className="h-8 w-8 mx-auto text-neutral-300" aria-hidden />
                <p className="mt-2 text-sm text-neutral-600">Aucune commande pour l’instant.</p>
                <Link href="/marketplace" className="mt-3 inline-block text-sm font-semibold text-[#2F7D32] underline">
                  Aller à la boutique
                </Link>
              </div>
            ) : (
              <ul className="bg-white rounded-2xl shadow-sm divide-y divide-neutral-100">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href="/dashboard/commandes" className="flex items-center gap-3 px-4 py-3.5 active:bg-neutral-50">
                      <Package className="h-5 w-5 text-neutral-500" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {o.order_number ? `Commande ${o.order_number}` : "Commande"}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          {" · "}
                          {ORDER_STATUS_LABELS[o.status || ""] || o.status || "—"}
                        </p>
                      </div>
                      {typeof o.total_amount === "number" ? (
                        <span className="text-sm font-semibold">{fmt(o.total_amount)} F</span>
                      ) : null}
                      <ChevronRight className="h-5 w-5 text-neutral-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/commandes" className="block">
              <Button variant="outline" className="w-full rounded-full h-11 bg-white">
                Toutes mes commandes
              </Button>
            </Link>
          </TabsContent>

          {walletEnabled ? (
            <TabsContent value="portefeuille" className="pt-4">
              <Link href="/wallet" className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm">
                <Wallet className="h-5 w-5 text-[#2F7D32]" aria-hidden />
                <span className="flex-1 font-medium">Ouvrir mon portefeuille</span>
                <ChevronRight className="h-5 w-5 text-neutral-300" aria-hidden />
              </Link>
            </TabsContent>
          ) : null}

          <TabsContent value="parametres" className="space-y-4 pt-4">
            {renderSections(settingsSections)}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-red-600 font-medium shadow-sm active:bg-red-50 disabled:opacity-60"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
              {isLoggingOut ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-neutral-400 py-4">
          GWA v{APP_VERSION} · Agriculture & Finance · Côte d&apos;Ivoire
        </p>
      </div>
    </div>
  )
}
