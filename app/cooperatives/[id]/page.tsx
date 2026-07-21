"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Calendar, ShieldCheck, Loader2,
} from "lucide-react"

interface CoopDetail {
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
}

export default function CooperativeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === "string" ? params.id : ""
  const [coop, setCoop] = useState<CoopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    ;(async () => {
      const { data, error } = await supabase
        .from("cooperatives")
        .select(
          "id, name, description, logo_url, sector, country, city, address, phone, email, website, registration_number, is_verified, founded_year",
        )
        .eq("id", id)
        .maybeSingle()

      if (error || !data) {
        setMissing(true)
        setCoop(null)
      } else {
        setCoop(data as CoopDetail)
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (missing || !coop) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">Coopérative introuvable</h1>
          <p className="text-muted-foreground mb-6">Cette fiche n&apos;existe pas ou a été retirée.</p>
          <Button asChild>
            <Link href="/cooperatives">Retour aux coopératives</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {coop.logo_url ? (
                  <Image src={coop.logo_url} alt={coop.name} width={64} height={64} className="object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                  {coop.name}
                  {coop.is_verified && <ShieldCheck className="h-5 w-5 text-primary" />}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[coop.city, coop.country].filter(Boolean).join(", ") || "—"}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {coop.sector && <Badge>{coop.sector}</Badge>}
                  {coop.founded_year && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      Depuis {coop.founded_year}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {coop.description || "Aucune description pour le moment."}
            </p>

            <div className="space-y-2 text-sm">
              {coop.phone && (
                <a href={`tel:${coop.phone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="h-4 w-4" /> {coop.phone}
                </a>
              )}
              {coop.email && (
                <a href={`mailto:${coop.email}`} className="flex items-center gap-2 hover:text-primary">
                  <Mail className="h-4 w-4" /> {coop.email}
                </a>
              )}
              {coop.website && (
                <a
                  href={coop.website.startsWith("http") ? coop.website : `https://${coop.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-primary"
                >
                  <Globe className="h-4 w-4" /> {coop.website}
                </a>
              )}
              {coop.address && (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> {coop.address}
                </p>
              )}
              {coop.registration_number && (
                <p className="text-muted-foreground">RCCM / n° : {coop.registration_number}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button asChild className="flex-1">
                <Link href={`/cooperatives/rejoindre?coop=${coop.id}`}>Rejoindre</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/cooperatives">Toutes les coopératives</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
