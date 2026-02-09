"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Search, Menu, Globe, Bell, Sprout, Hammer, User, LogOut, Package, Settings, ShoppingCart, Shield, Wallet } from 'lucide-react'
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  user_type: string | null
}

export function Navigation() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    const checkUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!isMounted) return
        
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          if (!isMounted) return
          
          // Check if user is admin
          const { data: adminRole } = await supabase
            .from('admin_roles')
            .select('role')
            .eq('user_id', authUser.id)
            .eq('is_active', true)
            .single()
          
          if (!isMounted) return
          
          setIsAdmin(!!adminRole)
          
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
            user_type: profile?.user_type || authUser.user_metadata?.user_type || null,
          })
        }
        if (isMounted) setIsLoading(false)
      } catch (error) {
        if (isMounted) setIsLoading(false)
      }
    }

    checkUser()

    // Ecouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (!isMounted) return
          
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: profile?.full_name || session.user.user_metadata?.full_name || null,
            user_type: profile?.user_type || session.user.user_metadata?.user_type || null,
          })
        } catch (error) {
          // Ignore errors when component unmounts
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsAdmin(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const getDashboardRoute = () => {
    const routes: Record<string, string> = {
      producteur: "/dashboard/farmer",
      artisan: "/dashboard/artisan",
      transformateur: "/dashboard/business",
      acheteur: "/dashboard/buyer",
      cooperative: "/dashboard/cooperative",
      entreprise: "/dashboard/business",
    }
    return routes[user?.user_type || ''] || "/dashboard"
  }

  const getInitials = () => {
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U'
  }

  return (
    <header className="hidden md:block sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl">
      <nav className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">G</span>
          </div>
          <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors hidden sm:block">GWA</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6 flex-1 mx-8">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="hover:text-primary transition-colors">
                  <Sprout className="h-4 w-4 mr-2" />
                  Agriculture
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid gap-3 p-6 w-[400px]">
                    <NavigationMenuLink asChild>
                      <Link
                        href="/agriculture"
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="text-sm font-medium leading-none">Marketplace Agricole</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Découvrez tous les produits agricoles
                        </p>
                      </Link>
                    </NavigationMenuLink>
                    <NavigationMenuLink asChild>
                      <Link
                        href="/agriculture/producteurs"
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="text-sm font-medium leading-none">Producteurs</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Vendez vos récoltes directement aux acheteurs
                        </p>
                      </Link>
                    </NavigationMenuLink>
                    <NavigationMenuLink asChild>
                      <Link
                        href="/agriculture/acheteurs"
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="text-sm font-medium leading-none">Acheteurs</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Approvisionnez-vous directement auprès des producteurs
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="hover:text-primary transition-colors">
                  <Hammer className="h-4 w-4 mr-2" />
                  Artisanat
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid gap-3 p-6 w-[400px]">
                    <NavigationMenuLink asChild>
                      <Link
                        href="/artisans"
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="text-sm font-medium leading-none">Galerie Artisanale</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Découvrez les créations africaines
                        </p>
                      </Link>
                    </NavigationMenuLink>
                    <NavigationMenuLink asChild>
                      <Link
                        href="/artisans/commissions"
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="text-sm font-medium leading-none">Commandes Sur-Mesure</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Créations personnalisées selon vos besoins
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/formations" legacyBehavior passHref>
                  <NavigationMenuLink className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                    Formations
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/cooperatives" legacyBehavior passHref>
                  <NavigationMenuLink className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                    Coopératives
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/communaute" legacyBehavior passHref>
                  <NavigationMenuLink className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                    Communauté
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/b2b" legacyBehavior passHref>
                  <NavigationMenuLink className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                    B2B
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* Search Bar */}
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="search"
                placeholder="Rechercher produits, artisans..."
                className="pl-8 bg-muted/50 focus:bg-background transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              <Link href="/panier">
                <Button variant="ghost" size="icon" className="hidden md:inline-flex relative hover:text-primary transition-colors">
                  <ShoppingCart className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="hidden md:inline-flex relative hover:text-primary transition-colors">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 bg-accent rounded-full animate-pulse" />
                </Button>
              </Link>
            </>
          )}

          <Select defaultValue="fr" onValueChange={(val) => {
              if (val !== "fr") {
                toast.info("Traduction bientôt disponible", {
                  description: "Cette fonctionnalité sera disponible prochainement."
                })
              }
            }}>
            <SelectTrigger className="w-[100px] hidden sm:flex hover:border-primary transition-colors">
              <Globe className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="pt">Português</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.full_name || 'Utilisateur'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={getDashboardRoute()}>
                    <User className="mr-2 h-4 w-4" />
                    Tableau de bord
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/products">
                    <Package className="mr-2 h-4 w-4" />
                    Mes produits
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/commandes">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Mes commandes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/wallet">
                    <Wallet className="mr-2 h-4 w-4" />
                    Mon portefeuille
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="text-primary">
                        <Shield className="mr-2 h-4 w-4" />
                        Back Office Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Se deconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" className="hidden md:inline-flex hover:text-primary transition-colors">
                  Connexion
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="hidden md:inline-flex hover:scale-105 transition-transform">
                  Commencer
                </Button>
              </Link>
            </>
          )}

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden hover:text-primary transition-colors">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4 mt-8">
                {user && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.full_name || 'Utilisateur'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                )}
                
                <Link href="/agriculture" className="text-lg font-medium hover:text-primary transition-colors p-2 rounded-lg hover:bg-accent flex items-center gap-2">
                  <Sprout className="h-5 w-5" />
                  Agriculture
                </Link>
                <Link href="/artisans" className="text-lg font-medium hover:text-primary transition-colors p-2 rounded-lg hover:bg-accent flex items-center gap-2">
                  <Hammer className="h-5 w-5" />
                  Artisanat
                </Link>
                <Link href="/formations" className="text-lg font-medium hover:text-primary transition-colors p-2 rounded-lg hover:bg-accent">
                  Formations
                </Link>
                <Link href="/cooperatives" className="text-lg font-medium hover:text-primary transition-colors p-2 rounded-lg hover:bg-accent">
                  Cooperatives
                </Link>
                <Link href="/communaute" className="text-lg font-medium hover:text-primary transition-colors p-2 rounded-lg hover:bg-accent">
                  Communaute
                </Link>
                <Link href="/b2b" className="text-lg font-medium hover:text-primary transition-colors p-2 rounded-lg hover:bg-accent">
                  B2B
                </Link>
                
                <div className="border-t pt-4 mt-4">
                  {user ? (
                    <>
                      <Link href={getDashboardRoute()} className="block mb-2">
                        <Button variant="outline" className="w-full justify-start bg-transparent">
                          <User className="mr-2 h-4 w-4" />
                          Tableau de bord
                        </Button>
                      </Link>
                      <Link href="/dashboard/products" className="block mb-2">
                        <Button variant="outline" className="w-full justify-start bg-transparent">
                          <Package className="mr-2 h-4 w-4" />
                          Mes produits
                        </Button>
                      </Link>
                      <Button variant="outline" className="w-full justify-start text-destructive bg-transparent" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                  Se déconnecter
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/auth/signup" className="block mb-2">
                        <Button className="w-full hover:scale-105 transition-transform">Commencer</Button>
                      </Link>
                      <Link href="/auth/login" className="block">
                        <Button variant="outline" className="w-full hover:bg-accent transition-colors bg-transparent">Connexion</Button>
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
