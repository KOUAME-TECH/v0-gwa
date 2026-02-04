"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, ShoppingBag, MessageSquare, DollarSign, Package, Calendar, Loader2 } from 'lucide-react'
import Link from "next/link"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [stats, setStats] = useState({
    products: 0,
    orders: 0,
    messages: 0,
    revenue: 0
  })

  useEffect(() => {
    let isMounted = true
    
    const loadDashboard = async () => {
      try {
        const supabase = createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!isMounted) return
        
        if (!user) {
          router.push("/auth/login")
          return
        }

        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (!isMounted) return
        setUserName(profile?.full_name || user.email?.split("@")[0] || "Utilisateur")

        // Check if user is admin
        const { data: adminRole } = await supabase
          .from("admin_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single()

        if (!isMounted) return
        
        if (adminRole) {
          router.push("/admin")
          return
        }

        // Load stats
        const [productsRes, ordersRes] = await Promise.all([
          supabase.from("products").select("id", { count: "exact" }).eq("seller_id", user.id),
          supabase.from("orders").select("id, total_amount", { count: "exact" }).or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        ])

        if (!isMounted) return
        
        const revenue = ordersRes.data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0

        setStats({
          products: productsRes.count || 0,
          orders: ordersRes.count || 0,
          messages: 0,
          revenue: revenue
        })

        setLoading(false)
      } catch (error) {
        if (isMounted) setLoading(false)
      }
    }

    loadDashboard()
    
    return () => {
      isMounted = false
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <Card className="w-full max-w-sm mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Bienvenue sur GWA</h2>
            <p className="text-muted-foreground text-center">
              Chargement de votre espace...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="h-14 md:hidden" />
      
      <main className="flex-1 bg-muted/30">
        <div className="container py-6 sm:py-8 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Bonjour, {userName} !</h1>
              <p className="text-muted-foreground">Bienvenue sur votre espace GWA</p>
            </div>
            <Button className="w-full sm:w-auto h-12 touch-target">
              <Calendar className="mr-2 h-4 w-4" />
              Planifier
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produits</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.products}</div>
                <p className="text-xs text-muted-foreground">
                  Vos annonces actives
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.orders}</div>
                <p className="text-xs text-muted-foreground">
                  Total commandes
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.revenue.toLocaleString()} CFA</div>
                <p className="text-xs text-muted-foreground">
                  Total des ventes
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.messages}</div>
                <p className="text-xs text-muted-foreground">
                  Non lus
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Activité récente */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Activité Récente</CardTitle>
                <CardDescription>Vos dernières interactions sur GWA</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { icon: Users, text: "Amara Diallo a accepté votre demande de connexion", time: "Il y a 2h" },
                    { icon: MessageSquare, text: "Nouveau message de Tech Hub Lagos", time: "Il y a 4h" },
                    { icon: ShoppingBag, text: "Commande #1234 livrée avec succès", time: "Il y a 1 jour" },
                    { icon: TrendingUp, text: "Votre profil a reçu 45 nouvelles visites", time: "Il y a 2 jours" },
                  ].map((activity, i) => (
                    <div key={i} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <activity.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

{/* Actions rapides */}
            <Card>
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
                <CardDescription>Gerez votre activite</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/dashboard/products/new">
                  <Button className="w-full justify-start h-12 touch-target">
                    <Package className="mr-2 h-4 w-4" />
                    Ajouter un Produit
                  </Button>
                </Link>
                <Link href="/dashboard/products">
                  <Button variant="outline" className="w-full justify-start h-12 touch-target bg-transparent">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Mes Produits
                  </Button>
                </Link>
                <Link href="/dashboard/commandes">
                  <Button variant="outline" className="w-full justify-start h-12 touch-target bg-transparent">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Mes Commandes
                  </Button>
                </Link>
                <Link href="/formations">
                  <Button variant="outline" className="w-full justify-start h-12 touch-target bg-transparent">
                    <Users className="mr-2 h-4 w-4" />
                    Formations
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
