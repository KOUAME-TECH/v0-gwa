"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { OwnProfile } from "@/lib/profile/self"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

export default function ProfilScreen({
  profile,
  partial,
}: {
  profile: OwnProfile
  partial: boolean
}) {
  const router = useRouter()
  const [stats, setStats] = useState({ products: 0, orders: 0, favorites: 0 })
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRoleLabel, setAdminRoleLabel] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const userId = profile.id

    const loadStats = async () => {
      try {
        const [productsRes, ordersRes, favoritesRes, adminRes, notifRes, msgRes] =
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
          ])

        if (!mounted) return

        setIsAdmin(!!adminRes.data)
        setAdminRoleLabel(
          adminRes.data?.role
            ? String(adminRes.data.role).replace(/_/g, " ")
            : null,
        )
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

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="gwa-shell-page lg:py-6">
      <header className="bg-white px-5 pt-4 pb-6 lg:rounded-2xl lg:shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Moi</h1>
          <Link
            href="/profil/edit"
            className="p-2 -mr-2 active:opacity-60"
            aria-label="Paramètres"
          >
            <Settings className="h-5 w-5 text-neutral-600" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-4 ring-neutral-100">
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
                <BadgeCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-neutral-500 mb-1">
              {getUserTypeLabel(profile.user_type)}
              {dual ? " · aussi admin backoffice" : ""}
            </p>
            {(profile.city || profile.country) && (
              <div className="flex items-center gap-1 text-sm text-neutral-500">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
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

        {profile.bio && (
          <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {dual ? (
          <div className="mt-4 rounded-xl border border-[#1F5C2E]/20 bg-[#1F5C2E]/5 px-3 py-2.5 text-sm text-[#1F5C2E]">
            <p className="font-medium">Double identité</p>
            <p className="text-xs text-[#1F5C2E]/80 mt-0.5 leading-relaxed">
              Votre espace {getUserTypeLabel(profile.user_type).toLowerCase()} et le
              backoffice sont séparés. Utilisez le menu ci-dessous pour basculer.
            </p>
          </div>
        ) : null}

        <Link href="/profil/edit" className="block mt-4">
          <Button
            variant="outline"
            className="w-full rounded-full h-11 font-medium bg-transparent"
          >
            Modifier le profil
          </Button>
        </Link>
      </header>

      <div className="px-5 -mt-3 mb-4">
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
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-4 text-center shadow-sm"
            >
              <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-4">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {section.title ? (
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {section.title}
              </p>
            ) : null}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {section.items.map((item, itemIdx) => (
              <Link key={`${item.href}-${item.label}`} href={item.href}>
                <div
                  className={`flex items-center gap-4 px-4 py-3.5 active:bg-neutral-50 ${
                    itemIdx !== section.items.length - 1
                      ? "border-b border-neutral-100"
                      : ""
                  } ${item.highlight ? "bg-[#2F7D32]/5" : ""}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      item.highlight ? "bg-[#2F7D32]" : "bg-neutral-100"
                    }`}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] ${
                        item.highlight ? "text-white" : "text-neutral-600"
                      }`}
                    />
                  </div>
                  <span className="flex-1 font-medium text-[15px]">
                    {item.label}
                  </span>
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
        ))}

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-red-600 font-medium shadow-sm active:bg-red-50 disabled:opacity-60"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {isLoggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>

        <p className="text-center text-xs text-neutral-400 py-4">
          GWA v{APP_VERSION} · Agriculture & Finance · Côte d&apos;Ivoire
        </p>
      </div>
      </div>
    </div>
  )
}
