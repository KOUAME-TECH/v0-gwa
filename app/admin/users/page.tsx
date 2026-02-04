"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Search,
  MoreHorizontal,
  Eye,
  Ban,
  CheckCircle,
  Shield,
  UserX,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react"

interface User {
  id: string
  full_name: string
  email: string
  phone?: string
  user_type: string
  country?: string
  city?: string
  is_verified: boolean
  is_suspended: boolean
  suspended_reason?: string
  rating?: number
  total_reviews?: number
  created_at: string
  avatar_url?: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 20

  useEffect(() => {
    fetchUsers()
  }, [filterType, filterStatus, page])

  const fetchUsers = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (filterType !== "all") {
      query = query.eq("user_type", filterType)
    }

    if (filterStatus === "verified") {
      query = query.eq("is_verified", true)
    } else if (filterStatus === "suspended") {
      query = query.eq("is_suspended", true)
    } else if (filterStatus === "unverified") {
      query = query.eq("is_verified", false)
    }

    const { data, count, error } = await query

    if (!error && data) {
      setUsers(data as User[])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      fetchUsers()
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setUsers(data as User[])
    }
    setLoading(false)
  }

  const handleSuspendUser = async () => {
    if (!selectedUser) return
    setActionLoading(true)

    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: true,
        suspended_reason: suspendReason,
        suspended_at: new Date().toISOString(),
        suspended_by: adminUser?.id,
      })
      .eq("id", selectedUser.id)

    if (!error) {
      // Log action
      await supabase.from("admin_logs").insert({
        admin_id: adminUser?.id,
        action: "suspend_user",
        entity_type: "user",
        entity_id: selectedUser.id,
        new_data: { suspended_reason: suspendReason },
      })

      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, is_suspended: true, suspended_reason: suspendReason }
          : u
      ))
      setSuspendDialogOpen(false)
      setSuspendReason("")
      setSelectedUser(null)
    }
    setActionLoading(false)
  }

  const handleUnsuspendUser = async (user: User) => {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: false,
        suspended_reason: null,
        suspended_at: null,
        suspended_by: null,
      })
      .eq("id", user.id)

    if (!error) {
      await supabase.from("admin_logs").insert({
        admin_id: adminUser?.id,
        action: "unsuspend_user",
        entity_type: "user",
        entity_id: user.id,
      })

      setUsers(users.map(u => 
        u.id === user.id 
          ? { ...u, is_suspended: false, suspended_reason: undefined }
          : u
      ))
    }
    setActionLoading(false)
  }

  const handleVerifyUser = async (user: User) => {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: true })
      .eq("id", user.id)

    if (!error) {
      await supabase.from("admin_logs").insert({
        admin_id: adminUser?.id,
        action: "verify_user",
        entity_type: "user",
        entity_id: user.id,
      })

      setUsers(users.map(u => 
        u.id === user.id ? { ...u, is_verified: true } : u
      ))
    }
    setActionLoading(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getUserTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      producer: { label: "Producteur", variant: "default" },
      artisan: { label: "Artisan", variant: "default" },
      transformer: { label: "Transformateur", variant: "secondary" },
      buyer: { label: "Acheteur", variant: "outline" },
      cooperative: { label: "Cooperative", variant: "default" },
      business: { label: "Entreprise", variant: "secondary" },
    }
    const config = typeConfig[type] || { label: type, variant: "outline" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">{totalCount} utilisateurs inscrits</p>
        </div>
        <Button variant="outline" onClick={fetchUsers} className="bg-transparent">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email ou telephone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                  className="pl-9"
                />
              </div>
              <Button onClick={searchUsers}>Rechercher</Button>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="producer">Producteur</SelectItem>
                  <SelectItem value="artisan">Artisan</SelectItem>
                  <SelectItem value="transformer">Transformateur</SelectItem>
                  <SelectItem value="buyer">Acheteur</SelectItem>
                  <SelectItem value="cooperative">Cooperative</SelectItem>
                  <SelectItem value="business">Entreprise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="verified">Verifies</SelectItem>
                  <SelectItem value="unverified">Non verifies</SelectItem>
                  <SelectItem value="suspended">Suspendus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucun utilisateur trouve</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Inscription</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className={user.is_suspended ? "opacity-60" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                              <AvatarFallback>{user.full_name?.charAt(0) || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name || "Sans nom"}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getUserTypeBadge(user.user_type || "user")}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {user.city && user.country ? `${user.city}, ${user.country}` : user.country || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.is_suspended && (
                              <Badge variant="destructive">Suspendu</Badge>
                            )}
                            {user.is_verified && (
                              <Badge variant="outline" className="border-green-500 text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verifie
                              </Badge>
                            )}
                            {!user.is_verified && !user.is_suspended && (
                              <Badge variant="secondary">Non verifie</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir le profil
                              </DropdownMenuItem>
                              {!user.is_verified && (
                                <DropdownMenuItem onClick={() => handleVerifyUser(user)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Verifier
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {user.is_suspended ? (
                                <DropdownMenuItem onClick={() => handleUnsuspendUser(user)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Reactiver
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedUser(user)
                                    setSuspendDialogOpen(true)
                                  }}
                                  className="text-destructive"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspendre
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Affichage de {page * pageSize + 1} a {Math.min((page + 1) * pageSize, totalCount)} sur {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="bg-transparent"
                  >
                    Precedent
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={(page + 1) * pageSize >= totalCount}
                    className="bg-transparent"
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre l'utilisateur</DialogTitle>
            <DialogDescription>
              Cette action empechera l'utilisateur d'acceder a son compte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src={selectedUser?.avatar_url || "/placeholder.svg"} />
                <AvatarFallback>{selectedUser?.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedUser?.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Raison de la suspension</Label>
              <Textarea
                id="reason"
                placeholder="Decrivez la raison de cette suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)} className="bg-transparent">
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleSuspendUser}
              disabled={actionLoading || !suspendReason.trim()}
            >
              {actionLoading ? "Suspension..." : "Suspendre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
