"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search, Users, MapPin, Calendar,
  ShieldCheck, Sprout, Hammer, Plus, Building2,
} from "lucide-react"

interface CooperativeData {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  sector: string | null
  country: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  registration_number: string | null
  is_verified: boolean
  founded_year: number | null
  created_at: string
}

export default function CooperativesPage() {
  const [cooperatives, setCooperatives] = useState<CooperativeData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedCountry, setSelectedCountry] = useState("all")
  const [user, setUser] = useState<{ id: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const { data, error } = await supabase
        .from("cooperatives")
        .select(
          "id, name, description, logo_url, sector, country, city, address, phone, email, website, registration_number, is_verified, founded_year, created_at",
        )
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[cooperatives]", error.message)
        setLoadError(error.message)
        setCooperatives([])
      } else {
        setCooperatives((data as CooperativeData[]) || [])
      }
      setLoading(false)
    }

    void loadData()
  }, [])

  const filteredCooperatives = cooperatives.filter((coop) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      coop.name.toLowerCase().includes(q) ||
      (coop.description || "").toLowerCase().includes(q)
    const matchesType = selectedType === "all" || coop.sector === selectedType
    const matchesCountry = selectedCountry === "all" || coop.country === selectedCountry
    return matchesSearch && matchesType && matchesCountry
  })

  const countries = [...new Set(cooperatives.map((c) => c.country).filter(Boolean))] as string[]

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Coopératives</h1>
            <p className="text-muted-foreground">
              Rejoignez ou créez une coopérative pour mutualiser vos ressources
            </p>
          </div>
          {user && (
            <Link href="/cooperatives/create">
              <Button className="mt-4 md:mt-0">
                <Plus className="h-4 w-4 mr-2" />
                Créer une coopérative
              </Button>
            </Link>
          )}
        </div>

        {loadError && (
          <Card className="mb-6 border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              Impossible de charger les coopératives. Réessayez plus tard.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cooperatives.length}</p>
                <p className="text-xs text-muted-foreground">Coopératives</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cooperatives.filter((c) => c.is_verified).length}</p>
                <p className="text-xs text-muted-foreground">Vérifiées</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Sprout className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {cooperatives.filter((c) => c.sector === "agriculture").length}
                </p>
                <p className="text-xs text-muted-foreground">Agricoles</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Hammer className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {cooperatives.filter((c) => c.sector && c.sector !== "agriculture").length}
                </p>
                <p className="text-xs text-muted-foreground">Autres secteurs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une coopérative..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="agriculture">Agriculture</SelectItem>
              <SelectItem value="commerce">Commerce</SelectItem>
              <SelectItem value="elevage">Élevage</SelectItem>
              <SelectItem value="peche">Pêche</SelectItem>
              <SelectItem value="transformation">Transformation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les pays</SelectItem>
              {countries.map((country) => (
                <SelectItem key={country} value={country}>{country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredCooperatives.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune coopérative trouvée</h3>
            <p className="text-muted-foreground mb-4">
              Soyez le premier à créer une coopérative dans votre région
            </p>
            {user ? (
              <Link href="/cooperatives/create">
                <Button>Créer une coopérative</Button>
              </Link>
            ) : (
              <Link href="/auth/login?redirect=/cooperatives/create">
                <Button>Se connecter pour créer</Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCooperatives.map((coop) => (
              <Card key={coop.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-32 bg-gradient-to-r from-primary/20 to-secondary/20">
                  <div className="absolute -bottom-8 left-4">
                    <div className="h-16 w-16 rounded-lg bg-background shadow-lg flex items-center justify-center overflow-hidden">
                      {coop.logo_url ? (
                        <Image src={coop.logo_url} alt={coop.name} width={64} height={64} className="object-cover" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                <CardHeader className="pt-12 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {coop.name}
                        {coop.is_verified && (
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {[coop.city, coop.country].filter(Boolean).join(", ") || "—"}
                      </CardDescription>
                    </div>
                    {coop.sector && (
                      <Badge variant={coop.sector === "agriculture" ? "default" : "secondary"}>
                        {coop.sector}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {coop.description || "Aucune description"}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {coop.founded_year ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Depuis {coop.founded_year}
                      </div>
                    ) : null}
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Link href={`/cooperatives/${coop.id}`} className="w-full">
                    <Button variant="outline" className="w-full bg-transparent">
                      Voir les détails
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
