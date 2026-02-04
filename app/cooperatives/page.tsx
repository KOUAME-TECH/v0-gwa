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
  Search, Users, MapPin, Phone, Mail, Globe, Calendar, 
  CheckCircle2, ShieldCheck, Sprout, Hammer, Plus, Building2 
} from "lucide-react"

interface Cooperative {
  id: string
  name: string
  description: string
  logo_url: string | null
  cover_image_url: string | null
  cooperative_type: string
  country: string
  city: string
  address: string
  phone: string
  email: string
  website: string | null
  registration_number: string
  is_verified: boolean
  member_count: number
  founded_year: number
  specialties: string[]
  created_at: string
}

export default function CooperativesPage() {
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedCountry, setSelectedCountry] = useState("all")
  const [user, setUser] = useState<any>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data } = await supabase
        .from('cooperatives')
        .select('*')
        .order('member_count', { ascending: false })

      if (data) {
        setCooperatives(data)
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const filteredCooperatives = cooperatives.filter(coop => {
    const matchesSearch = coop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         coop.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedType === "all" || coop.cooperative_type === selectedType
    const matchesCountry = selectedCountry === "all" || coop.country === selectedCountry
    return matchesSearch && matchesType && matchesCountry
  })

  const countries = [...new Set(cooperatives.map(c => c.country))].filter(Boolean)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Cooperatives</h1>
            <p className="text-muted-foreground">
              Rejoignez ou creez une cooperative pour mutualiser vos ressources
            </p>
          </div>
          {user && (
            <Link href="/cooperatives/create">
              <Button className="mt-4 md:mt-0">
                <Plus className="h-4 w-4 mr-2" />
                Creer une cooperative
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cooperatives.length}</p>
                <p className="text-xs text-muted-foreground">Cooperatives</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {cooperatives.reduce((acc, c) => acc + c.member_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Membres total</p>
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
                  {cooperatives.filter(c => c.cooperative_type === 'agriculture').length}
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
                  {cooperatives.filter(c => c.cooperative_type === 'artisanat').length}
                </p>
                <p className="text-xs text-muted-foreground">Artisanales</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une cooperative..."
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
              <SelectItem value="artisanat">Artisanat</SelectItem>
              <SelectItem value="mixte">Mixte</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les pays</SelectItem>
              {countries.map(country => (
                <SelectItem key={country} value={country}>{country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cooperatives Grid */}
        {filteredCooperatives.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune cooperative trouvee</h3>
            <p className="text-muted-foreground mb-4">
              Soyez le premier a creer une cooperative dans votre region
            </p>
            {user && (
              <Link href="/cooperatives/create">
                <Button>Creer une cooperative</Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCooperatives.map(coop => (
              <Card key={coop.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-32 bg-gradient-to-r from-primary/20 to-secondary/20">
                  {coop.cover_image_url && (
                    <Image
                      src={coop.cover_image_url || "/placeholder.svg"}
                      alt={coop.name}
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute -bottom-8 left-4">
                    <div className="h-16 w-16 rounded-lg bg-background shadow-lg flex items-center justify-center overflow-hidden">
                      {coop.logo_url ? (
                        <Image src={coop.logo_url || "/placeholder.svg"} alt={coop.name} width={64} height={64} className="object-cover" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
                
                <CardHeader className="pt-12 pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {coop.name}
                        {coop.is_verified && (
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {coop.city}, {coop.country}
                      </CardDescription>
                    </div>
                    <Badge variant={coop.cooperative_type === 'agriculture' ? 'default' : 'secondary'}>
                      {coop.cooperative_type}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {coop.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {coop.specialties?.slice(0, 3).map((spec, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {coop.member_count} membres
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Depuis {coop.founded_year}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-2">
                  <Link href={`/cooperatives/${coop.id}`} className="w-full">
                    <Button variant="outline" className="w-full bg-transparent">
                      Voir les details
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
