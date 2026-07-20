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
  UserPlus,
} from "lucide-react"
import {
  ADMIN_ROLE_LABELS,
  type AdminRole,
  isAdminRole,
  isSuperAdmin,
} from "@/lib/auth/admin-permissions"

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
  admin_role?: AdminRole | null
}

interface AdminRoleRow {
  user_id: string
  role: AdminRole
  is_active: boolean
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
  const [callerRole, setCallerRole] = useState<AdminRole | null>(null)
  const pageSize = 20

  useEffect(() => {
    void loadCallerRole()
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [filterType, filterStatus, page])

  const loadCallerRole = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (data?.role && isAdminRole(data.role)) {
      setCallerRole(data.role)
    }
  }

  const attachAdminRoles = async (rows: User[]) => {
    if (rows.length === 0) return rows

    const supabase = createClient()
    const ids = rows.map((u) => u.id)
    const { data: roles } = await supabase
      .from("admin_roles")
      .select("user_id, role, is_active")
      .in("user_id", ids)
      .eq("is_active", true)

    const roleByUser = new Map<string, AdminRole>()
    for (const row of (roles || []) as AdminRoleRow[]) {
      if (isAdminRole(row.role)) {
        roleByUser.set(row.user_id, row.role)
      }
    }

    return rows.map((u) => ({
      ...u,
      admin_role: roleByUser.get(u.id) ?? null,
    }))
  }

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
      const enriched = await attachAdminRoles(data as User[])
      setUsers(enriched)
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
      const enriched = await attachAdminRoles(data as User[])
      setUsers(enriched)
    }
    setLoading(false)
  }

  const handleSuspendUser = async () => {
    if (!selectedUser) return
    setActionLoading(true)

    const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suspend", reason: suspendReason }),
    })

    if (res.ok) {
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

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsuspend" }),
    })

    if (res.ok) {
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

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify" }),
    })

    if (res.ok) {
      setUsers(users.map(u =>
        u.id === user.id ? { ...u, is_verified: true } : u
      ))
    }
    setActionLoading(false)
  }

  const handleGrantSupport = async (user: User) => {
    setActionLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant_support" }),
    })
    if (res.ok) {
      setUsers(users.map((u) =>
        u.id === user.id ? { ...u, admin_role: "support" } : u,
      ))
    }
    setActionLoading(false)
  }

  const handleGrantAdmin = async (user: User) => {
    setActionLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant_admin" }),
    })
    if (res.ok) {
      setUsers(users.map((u) =>
        u.id === user.id ? { ...u, admin_role: "admin" } : u,
      ))
    }
    setActionLoading(false)
  }

  const handleRevokeAdmin = async (user: User) => {
    setActionLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_admin" }),
    })
    if (res.ok) {
      setUsers(users.map((u) =>
        u.id === user.id ? { ...u, admin_role: null } : u,
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
      producteur: { label: "Producteur", variant: "default" },
      acheteur: { label: "Acheteur", variant: "outline" },
      cooperative: { label: "Coopérative", variant: "default" },
    }
    const config = typeConfig[type] || { label: type, variant: "outline" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getAdminRoleBadge = (role: AdminRole | null | undefined) => {
    if (!role) return null
    return (
      <Badge variant="outline" className="border-[#2F7D32] text-[#2F7D32]">
        <Shield className="h-3 w-3 mr-1" />
        {ADMIN_ROLE_LABELS[role]}
      </Badge>
    )
  }

  const canManageRoles = callerRole ? isSuperAdmin(callerRole) : false

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">{totalCount} utilisateurs inscrits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="bg-transparent">
            <a href="/api/admin/export?entity=users" download>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </a>
          </Button>
          <Button variant="outline" onClick={fetchUsers} className="bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email ou téléphone..."
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
                  <SelectItem value="producteur">Producteur</SelectItem>
                  <SelectItem value="acheteur">Acheteur</SelectItem>
                  <SelectItem value="cooperative">Coopérative</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="verified">Vérifiés</SelectItem>
                  <SelectItem value="unverified">Non vérifiés</SelectItem>
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
              <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
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
                                Vérifié
                              </Badge>
                            )}
                            {!user.is_verified && !user.is_suspended && (
                              <Badge variant="secondary">Non vérifié</Badge>
                            )}
                            {getAdminRoleBadge(user.admin_role)}
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
                              <DropdownMenuItem
                                onClick={() => {
                                  window.open(`/profil/${user.id}`, "_blank", "noopener,noreferrer")
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Voir le profil
                              </DropdownMenuItem>
                              {!user.is_verified && (
                                <DropdownMenuItem onClick={() => handleVerifyUser(user)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Vérifier
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {user.is_suspended ? (
                                <DropdownMenuItem onClick={() => handleUnsuspendUser(user)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Réactiver
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
                              {canManageRoles && user.admin_role !== "super_admin" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>Accès back-office</DropdownMenuLabel>
                                  {!user.admin_role && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleGrantSupport(user)}>
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Donner accès Support
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleGrantAdmin(user)}>
                                        <Shield className="h-4 w-4 mr-2" />
                                        Donner accès Admin
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {user.admin_role === "support" && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleGrantAdmin(user)}>
                                        <Shield className="h-4 w-4 mr-2" />
                                        Promouvoir Admin
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleRevokeAdmin(user)}
                                        className="text-destructive"
                                      >
                                        <UserX className="h-4 w-4 mr-2" />
                                        Révoquer
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {user.admin_role === "admin" && (
                                    <DropdownMenuItem
                                      onClick={() => handleRevokeAdmin(user)}
                                      className="text-destructive"
                                    >
                                      <UserX className="h-4 w-4 mr-2" />
                                      Révoquer
                                    </DropdownMenuItem>
                                  )}
                                </>
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
                  Affichage de {page * pageSize + 1} à {Math.min((page + 1) * pageSize, totalCount)} sur {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="bg-transparent"
                  >
                    Précédent
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
              Cette action empêchera l{"'"}utilisateur d{"'"}accéder à son compte.
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
                placeholder="Décrivez la raison de cette suspension..."
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
