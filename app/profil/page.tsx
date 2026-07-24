"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
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
  Wallet,
  Bell,
  HelpCircle,
  Star,
  Shield,
  Download,
  TrendingUp,
  FileText,
  ShieldCheck,
} from "lucide-react"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"
type Profile = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
  rating: number | null
  phone?: string | null
  phone_verified?: boolean | null
  linked_email?: string | null
}

type MenuItem = {
  icon: typeof Package
  label: string
  href: string
  count?: number
  highlight?: boolean
}

const APP_VERSION = "1.0.0"

export default function ProfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState({ products: 0, orders: 0, favorites: 0 })
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/auth/login?redirect=/profil")
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (!mounted) return

      if (profileData) {
        setProfile({ ...profileData, email: user.email || profileData.email || "" })
      }

      const [productsRes, ordersRes, favoritesRes, adminRes, notifRes, msgRes] =
        await Promise.all([
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", user.id),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
          supabase
            .from("favorites")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("admin_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .neq("sender_id", user.id),
        ])

      if (!mounted) return

      setIsAdmin(!!adminRes.data)
      setUnreadNotifs(notifRes.count || 0)
      setUnreadMsgs(msgRes.count || 0)
      setStats({
        products: productsRes.count || 0,
        orders: ordersRes.count || 0,
        favorites: favoritesRes.count || 0,
      })
      setIsLoading(false)
    }

    void loadProfile()
    return () => {
      mounted = false
    }
  }, [supabase, router])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-5 gwa-shell-page">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-neutral-100 rounded w-32" />
              <div className="h-4 bg-neutral-100 rounded w-24" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-5 gwa-shell-page">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Connectez-vous</h2>
          <p className="text-neutral-500 text-sm mb-6">
            pour accéder à votre espace Moi
          </p>
          <Link href="/auth/login?redirect=/profil">
            <Button className="rounded-full px-8">Se connecter</Button>
          </Link>
        </div>
      </div>
    )
  }

  const isSeller = [
    "producteur",
    "transformateur",
    "cooperative",
    "entreprise",
    "farmer",
    "processor",
  ].includes(profile.user_type || "")
  const isCooperative = profile.user_type === "cooperative"

  const getMainMenuItems = (): MenuItem[] => {
    if (isSeller || isCooperative) {
      return [
        {
          icon: Package,
          label: isCooperative ? "Ma coopérative" : "Mes produits",
          href: isCooperative ? "/dashboard/cooperative" : "/dashboard/products",
          count: stats.products,
        },
        {
          icon: ShoppingBag,
          label: "Mes ventes",
          href: "/dashboard/commandes",
          count: stats.orders,
        },
        { icon: Wallet, label: "Portefeuille", href: "/wallet" },
        { icon: Star, label: "Mes avis", href: "/dashboard/reviews" },
      ]
    }
    return [
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
      { icon: Wallet, label: "Portefeuille", href: "/wallet" },
    ]
  }

  const menuSections: { items: MenuItem[] }[] = [
    ...(isAdmin
      ? [{ items: [{ icon: Shield, label: "Administration", href: "/admin", highlight: true }] }]
      : []),
    { items: getMainMenuItems() },
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
        { icon: HelpCircle, label: "Aide & Contact", href: "/contact" },
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
              <h2 className="text-lg font-semibold truncate">
                {profile.full_name || "Utilisateur GWA"}
              </h2>
              {shouldShowVerifiedBadge(profile) && (
                <BadgeCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-neutral-500 mb-1">
              {getUserTypeLabel(profile.user_type)}
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

        {profile.bio && (
          <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
            {profile.bio}
          </p>
        )}

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
          <div
            key={idx}
            className="bg-white rounded-2xl overflow-hidden shadow-sm"
          >
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
