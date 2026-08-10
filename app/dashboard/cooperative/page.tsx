"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users, Package, MapPin, Bell, ArrowLeft,
  ChevronRight, UserPlus, BarChart3, Settings,
  Building2, Sprout, CheckCircle2, AlertCircle, Globe, Plus, Copy
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { isFactoringEligible } from "@/lib/factoring/eligibility"
import { Banknote } from "lucide-react"
import {
  canAssignCoopRoles,
  canInviteMembers,
  isCoopManagerRole,
  roleBadgeLabel,
  type CoopMemberRole,
} from "@/lib/cooperatives/roles"
import {
  COOP_MIN_ACTIVE_MEMBERS,
  evaluateCoopQualification,
} from "@/lib/cooperatives/validation-policy"

interface Member {
  id: string
  full_name: string
  user_type: string
  city: string
  is_verified: boolean
  avatar_url: string | null
  role?: string
  products_count?: number
}

interface Coop {
  id: string
  name: string
  city: string | null
  country: string | null
  logo_url: string | null
  is_verified: boolean
  created_at?: string | null
  validation_status?: string | null
  legal_documents?: unknown
  registration_number?: string | null
}

export default function CooperativeDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [coop, setCoop] = useState<Coop | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalProducts: 0,
    farmers: 0,
    managers: 0,
  })
  const [qualificationBanner, setQualificationBanner] = useState<string | null>(null)
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const inviteLink = coop
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cooperatives/rejoindre?coop=${coop.id}`
    : ""

  const handleInvite = useCallback(async () => {
    if (!inviteLink) return
    if (!canInviteMembers(myRole)) {
      toast.error("Seuls les administrateurs et gestionnaires peuvent inviter")
      return
    }
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.success("Lien d'invitation copié — partagez-le avec vos producteurs")
    } catch {
      toast.info(inviteLink)
    }
  }, [inviteLink, myRole])

  const handleRoleChange = useCallback(
    async (memberId: string, role: CoopMemberRole) => {
      if (!coop || !canAssignCoopRoles(myRole)) return
      setRoleUpdating(memberId)
      try {
        const res = await fetch("/api/cooperatives/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cooperative_id: coop.id,
            user_id: memberId,
            role,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || "Changement de rôle impossible")
          return
        }
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
        )
        setStats((s) => ({
          ...s,
          managers: [
            ...members.filter((m) => m.id !== memberId),
            { role } as Member,
          ].filter((m) => isCoopManagerRole(m.role)).length,
        }))
        toast.success(`Rôle mis à jour : ${roleBadgeLabel(role)}`)
      } catch {
        toast.error("Erreur réseau")
      } finally {
        setRoleUpdating(null)
      }
    },
    [coop, myRole, members],
  )

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push("/auth/login")
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setProfile(profileData)

      // Résolution multi-gestion : membership d’abord (admin/manager/member), puis admin_id, puis coop_id
      let coopData: Coop | null = null
      let resolvedRole: string | null = null

      const { data: membership } = await supabase
        .from("cooperative_members")
        .select("role, cooperative_id")
        .eq("user_id", authUser.id)
        .neq("is_active", false)
        .order("joined_at", { ascending: false })
        .limit(5)

      const preferred =
        membership?.find((m: { role: string }) => m.role === "admin") ||
        membership?.find((m: { role: string }) => m.role === "manager") ||
        membership?.[0]

      if (preferred?.cooperative_id) {
        const { data: memberCoop } = await supabase
          .from("cooperatives")
          .select(
            "id, name, city, country, logo_url, is_verified, created_at, validation_status, legal_documents, registration_number",
          )
          .eq("id", preferred.cooperative_id)
          .maybeSingle()
        coopData = memberCoop
        resolvedRole = preferred.role
      }

      if (!coopData) {
        const { data: adminCoop } = await supabase
          .from("cooperatives")
          .select(
            "id, name, city, country, logo_url, is_verified, created_at, validation_status, legal_documents, registration_number",
          )
          .eq("admin_id", authUser.id)
          .maybeSingle()
        if (adminCoop) {
          coopData = adminCoop
          resolvedRole = "admin"
        }
      }

      if (!coopData && profileData?.coop_id) {
        const { data: linkedCoop } = await supabase
          .from("cooperatives")
          .select(
            "id, name, city, country, logo_url, is_verified, created_at, validation_status, legal_documents, registration_number",
          )
          .eq("id", profileData.coop_id)
          .maybeSingle()
        coopData = linkedCoop
      }

      setCoop(coopData)
      setMyRole(resolvedRole)

      if (coopData) {
        const { data: memberRows } = await supabase
          .from('cooperative_members')
          .select('role, user_id, profiles:user_id(id, full_name, user_type, city, is_verified, avatar_url)')
          .eq('cooperative_id', coopData.id)
          .order('joined_at', { ascending: false })

        const baseMembers: Member[] = (memberRows || [])
          .map((row: any) => {
            const p = row.profiles
            if (!p) return null
            return {
              id: p.id,
              full_name: p.full_name,
              user_type: p.user_type,
              city: p.city,
              is_verified: p.is_verified,
              avatar_url: p.avatar_url,
              role: row.role,
            } as Member
          })
          .filter(Boolean) as Member[]

        if (!resolvedRole) {
          const mine = baseMembers.find((m) => m.id === authUser.id)
          if (mine?.role) {
            resolvedRole = mine.role
            setMyRole(mine.role)
          }
        }

        const membersWithProducts = await Promise.all(
          baseMembers.map(async (member) => {
            const { count } = await supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('seller_id', member.id)
              .eq('status', 'active')
            return { ...member, products_count: count || 0 }
          })
        )
        setMembers(membersWithProducts)

        const farmers = membersWithProducts.filter(m => m.user_type === 'producteur').length
        const managers = membersWithProducts.filter((m) => isCoopManagerRole(m.role)).length
        const totalProducts = membersWithProducts.reduce((s, m) => s + (m.products_count || 0), 0)
        setStats({
          totalMembers: membersWithProducts.length,
          totalProducts,
          farmers,
          managers,
        })

        if (coopData.created_at) {
          const q = evaluateCoopQualification({
            createdAt: coopData.created_at,
            activeMemberCount: membersWithProducts.length,
            hasLegalDocs: Boolean(
              (Array.isArray(coopData.legal_documents) &&
                coopData.legal_documents.length > 0) ||
                coopData.registration_number,
            ),
            adminStatus: (coopData.validation_status as any) || null,
          })
          setQualificationBanner(q.bannerMessage)
        }
      }

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0FDF4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]" />
      </div>
    )
  }

  // Pas encore de coopérative : créer ou rejoindre
  if (!coop) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#E8F5E9] to-[#FFF6E5] pb-24">
        <header className="px-4 pt-6 pb-4">
          <p className="text-sm font-medium text-[#C27D10]">Espace coopérative</p>
          <h1 className="text-2xl font-bold text-[#1F5C2E]">Rejoins ou crée</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Deux chemins : créer ta coop, ou rejoindre une existante.
          </p>
        </header>
        <main className="space-y-3 px-4">
          <Link
            href="/cooperatives/create"
            className="flex items-center gap-3 rounded-2xl bg-[#1F5C2E] p-4 text-white"
          >
            <Plus className="h-6 w-6" />
            <div>
              <p className="font-semibold">Créer ma coopérative</p>
              <p className="text-xs text-white/80">Tu seras administrateur</p>
            </div>
          </Link>
          <Link
            href="/cooperatives/rejoindre"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#1F5C2E]/15"
          >
            <UserPlus className="h-6 w-6 text-[#1F5C2E]" />
            <div>
              <p className="font-semibold text-[#1a1a1a]">Rejoindre une coop</p>
              <p className="text-xs text-[#6B7280]">Avec un lien d’invitation</p>
            </div>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F5E9] to-[#FFF6E5] pb-24">
      {/* Header Coopérative */}
      <header className="bg-gradient-to-br from-[#1F5C2E] to-[#2d7a3e] text-white px-4 pt-8 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">{coop.name}</h1>
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </Link>
        </div>

        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-white/80">
            <span>Membres actifs</span>
            <span className="font-semibold text-white">
              {stats.totalMembers}/{COOP_MIN_ACTIVE_MEMBERS}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-[#F39A1F] transition-all"
              style={{
                width: `${Math.min(100, (stats.totalMembers / COOP_MIN_ACTIVE_MEMBERS) * 100)}%`,
              }}
            />
          </div>
        </div>

        {canInviteMembers(myRole) ? (
          <div className="space-y-2">
            <Button
              onClick={handleInvite}
              className="w-full rounded-full bg-white text-[#1F5C2E] hover:bg-white/90"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Copier le lien d’invitation
            </Button>
            {inviteLink ? (
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Rejoins notre coop sur GWA : ${inviteLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-full bg-[#25D366] py-2 text-center text-xs font-semibold text-white"
                >
                  WhatsApp
                </a>
                <a
                  href={`sms:?body=${encodeURIComponent(`Rejoins notre coop GWA : ${inviteLink}`)}`}
                  className="flex-1 rounded-full bg-white/20 py-2 text-center text-xs font-semibold text-white"
                >
                  SMS
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className="px-4 -mt-2 pt-4 space-y-4">
        {qualificationBanner && (
          <div className="rounded-2xl bg-white p-4 text-sm text-[#4B5563] ring-1 ring-[#1F5C2E]/10">
            <p className="font-semibold text-[#111827] mb-1">Checklist qualification</p>
            <p>{qualificationBanner}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant={stats.totalMembers >= COOP_MIN_ACTIVE_MEMBERS ? "default" : "secondary"}>
                Membres {stats.totalMembers}/{COOP_MIN_ACTIVE_MEMBERS}
              </Badge>
              <Badge
                variant={
                  (Array.isArray(coop.legal_documents) && coop.legal_documents.length > 0) ||
                  coop.registration_number
                    ? "default"
                    : "secondary"
                }
              >
                Docs légaux
              </Badge>
              <Badge variant={coop.validation_status === "qualified" ? "default" : "secondary"}>
                Statut {coop.validation_status || "en cours"}
              </Badge>
            </div>
            {!(
              (Array.isArray(coop.legal_documents) && coop.legal_documents.length > 0) ||
              coop.registration_number
            ) ? (
              <div className="mt-3 flex gap-2">
                <Link href="/contact" className="text-xs font-medium text-[#1F5C2E] underline">
                  Contacter le support
                </Link>
                <Link href="/profil/edit" className="text-xs font-medium text-[#1F5C2E] underline">
                  Compléter le profil
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/products"
            className="rounded-2xl bg-white p-4 ring-1 ring-black/5"
          >
            <Package className="h-5 w-5 text-[#C27D10]" />
            <p className="mt-2 text-2xl font-bold">{stats.totalProducts}</p>
            <p className="text-xs text-[#6B7280]">Catalogue coop</p>
          </Link>
          <Link href="/scg" className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <BarChart3 className="h-5 w-5 text-[#1F5C2E]" />
            <p className="mt-2 text-sm font-semibold">Score de confiance</p>
            <p className="text-xs text-[#6B7280]">Confiance groupe</p>
          </Link>
        </div>

        {isFactoringEligible({
          scg_bancable: profile?.scg_bancable,
          scg_score: profile?.scg_score,
        }) ? (
          <Link
            href="/affacturage"
            className="flex items-center gap-3 rounded-2xl bg-[#1F5C2E] px-4 py-3 text-white"
          >
            <Banknote className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Avance sur vente disponible</p>
              <p className="text-xs text-white/80">Avance sur trésorerie</p>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}

        {/* Liste des membres */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#1F5C2E]" />
              Membres
            </h3>
          </div>

          {members.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-[#1F5C2E]/30 mx-auto mb-4" />
                <h4 className="font-semibold text-[#111827] mb-2">Aucun membre</h4>
                <p className="text-sm text-[#4B5563] mb-4">
                  Invite des producteurs avec le bouton en haut de page.
                </p>
                {canInviteMembers(myRole) ? (
                  <Button onClick={handleInvite} className="bg-[#1F5C2E]">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Copier le lien d’invitation
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <Card key={member.id} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#F0FDF4] flex items-center justify-center overflow-hidden">
                        {member.avatar_url ? (
                          <Image src={member.avatar_url} alt="" width={48} height={48} className="object-cover" />
                        ) : (
                          <span className="text-[#059669] font-bold">
                            {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#111827]">{member.full_name || "Membre"}</p>
                          {member.is_verified && (
                            <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <Badge className="bg-[#2F7D32]/10 text-[#2F7D32]">
                            {roleBadgeLabel(member.role)}
                          </Badge>
                          <span className="text-xs text-[#4B5563] flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {member.city || "N/A"}
                          </span>
                        </div>
                        {canAssignCoopRoles(myRole) && (
                          <select
                            className="mt-2 h-8 text-xs rounded-lg border border-gray-200 bg-white px-2 text-[#4B5563]"
                            value={
                              member.role === "admin" ||
                              member.role === "manager" ||
                              member.role === "member"
                                ? member.role
                                : "member"
                            }
                            disabled={roleUpdating === member.id}
                            onChange={(e) =>
                              handleRoleChange(
                                member.id,
                                e.target.value as CoopMemberRole,
                              )
                            }
                          >
                            <option value="member">Membre</option>
                            <option value="manager">Gestionnaire</option>
                            <option value="admin">Administrateur</option>
                          </select>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#111827]">{member.products_count || 0}</p>
                        <p className="text-xs text-[#4B5563]">produits</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Alertes qualification — seulement si action requise */}
        {(stats.totalMembers < COOP_MIN_ACTIVE_MEMBERS || !coop.is_verified) && (
          <Card className="bg-white border-0 shadow-sm border-l-4 border-l-yellow-500 mb-6">
            <CardContent className="p-4 text-sm text-[#4B5563] space-y-1">
              {stats.totalMembers < COOP_MIN_ACTIVE_MEMBERS && (
                <p>
                  Membres : {stats.totalMembers}/{COOP_MIN_ACTIVE_MEMBERS}
                </p>
              )}
              {!coop.is_verified && <p>Documents légaux à déposer.</p>}
            </CardContent>
          </Card>
        )}

        {/* Paramètres */}
        <Link href="/profil/edit">
          <Card className="bg-gradient-to-r from-[#059669]/10 to-[#10B981]/10 border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-[#059669]" />
                  <div>
                    <h4 className="font-semibold text-[#111827]">Paramètres</h4>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#4B5563]" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </main>
    </div>
  )
}
