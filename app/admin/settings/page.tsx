"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Save,
  RefreshCw,
  Percent,
  Globe,
  CreditCard,
  Shield,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

interface PlatformSettings {
  commission_rate: { agriculture: number; default: number }
  min_withdrawal: { XOF: number; EUR: number; USD: number }
  max_images_per_product: number
  auto_approve_verified_sellers: boolean
  maintenance_mode: boolean
  supported_countries: string[]
  supported_currencies: string[]
  payment_methods: string[]
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("platform_settings")
      .select("key, value")

    if (!error && data) {
      const settingsMap: Record<string, unknown> = {}
      for (const item of data) {
        settingsMap[item.key] = item.value
      }
      setSettings({
        commission_rate: (settingsMap.commission_rate as PlatformSettings["commission_rate"]) || { agriculture: 5, default: 6 },
        min_withdrawal: (settingsMap.min_withdrawal as PlatformSettings["min_withdrawal"]) || { XOF: 5000, EUR: 10, USD: 10 },
        max_images_per_product: Number(settingsMap.max_images_per_product) || 10,
        auto_approve_verified_sellers: settingsMap.auto_approve_verified_sellers === true || settingsMap.auto_approve_verified_sellers === "true",
        maintenance_mode: settingsMap.maintenance_mode === true || settingsMap.maintenance_mode === "true",
        supported_countries: (settingsMap.supported_countries as string[]) || [],
        supported_currencies: (settingsMap.supported_currencies as string[]) || [],
        payment_methods: (settingsMap.payment_methods as string[]) || [],
      })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    setSuccess(false)

    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    const updates = [
      { key: "commission_rate", value: settings.commission_rate },
      { key: "min_withdrawal", value: settings.min_withdrawal },
      { key: "max_images_per_product", value: settings.max_images_per_product },
      { key: "auto_approve_verified_sellers", value: settings.auto_approve_verified_sellers },
      { key: "maintenance_mode", value: settings.maintenance_mode },
    ]

    for (const update of updates) {
      await supabase
        .from("platform_settings")
        .update({ 
          value: update.value,
          updated_by: adminUser?.id,
          updated_at: new Date().toISOString()
        })
        .eq("key", update.key)
    }

    await supabase.from("admin_logs").insert({
      admin_id: adminUser?.id,
      action: "update_settings",
      entity_type: "platform_settings",
      new_data: settings,
    })

    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration de la plateforme GWA</p>
        </div>
        <div className="flex gap-2">
          {success && (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Enregistre
            </Badge>
          )}
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Paramètres généraux
              </CardTitle>
              <CardDescription>
                Configuration générale de la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mode maintenance</Label>
                  <p className="text-sm text-muted-foreground">
                    Désactive l{"'"}accès à la plateforme pour les utilisateurs
                  </p>
                </div>
                <Switch
                  checked={settings.maintenance_mode}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, maintenance_mode: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-approbation vendeurs vérifiés</Label>
                  <p className="text-sm text-muted-foreground">
                    Les produits des vendeurs vérifiés sont automatiquement approuvés
                  </p>
                </div>
                <Switch
                  checked={settings.auto_approve_verified_sellers}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, auto_approve_verified_sellers: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Images maximum par produit</Label>
                <Input
                  type="number"
                  value={settings.max_images_per_product}
                  onChange={(e) => 
                    setSettings({ ...settings, max_images_per_product: parseInt(e.target.value) || 10 })
                  }
                  className="w-32"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Pays et devises
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Pays supportés</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {settings.supported_countries.map((country) => (
                    <Badge key={country} variant="secondary">{country}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Devises supportées</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {settings.supported_currencies.map((currency) => (
                    <Badge key={currency} variant="outline">{currency}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Taux de commission
              </CardTitle>
              <CardDescription>
                Commissions prélevées sur les ventes par catégorie
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Agriculture (%)</Label>
                  <Input
                    type="number"
                    value={settings.commission_rate.agriculture}
                    onChange={(e) => 
                      setSettings({ 
                        ...settings, 
                        commission_rate: { 
                          ...settings.commission_rate, 
                          agriculture: parseFloat(e.target.value) || 0 
                        } 
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Par défaut (%)</Label>
                  <Input
                    type="number"
                    value={settings.commission_rate.default}
                    onChange={(e) => 
                      setSettings({ 
                        ...settings, 
                        commission_rate: { 
                          ...settings.commission_rate, 
                          default: parseFloat(e.target.value) || 0 
                        } 
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retrait minimum</CardTitle>
              <CardDescription>
                Montant minimum pour les demandes de retrait
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>XOF</Label>
                  <Input
                    type="number"
                    value={settings.min_withdrawal.XOF}
                    onChange={(e) => 
                      setSettings({ 
                        ...settings, 
                        min_withdrawal: { 
                          ...settings.min_withdrawal, 
                          XOF: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>EUR</Label>
                  <Input
                    type="number"
                    value={settings.min_withdrawal.EUR}
                    onChange={(e) => 
                      setSettings({ 
                        ...settings, 
                        min_withdrawal: { 
                          ...settings.min_withdrawal, 
                          EUR: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>USD</Label>
                  <Input
                    type="number"
                    value={settings.min_withdrawal.USD}
                    onChange={(e) => 
                      setSettings({ 
                        ...settings, 
                        min_withdrawal: { 
                          ...settings.min_withdrawal, 
                          USD: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Méthodes de paiement
              </CardTitle>
              <CardDescription>
                Méthodes de paiement actives sur la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {settings.payment_methods.map((method) => (
                  <Badge key={method} variant="secondary" className="text-sm py-1 px-3">
                    {method.replace("_", " ").toUpperCase()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sécurité
              </CardTitle>
              <CardDescription>
                Paramètres de sécurité de la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Mode maintenance actif</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.maintenance_mode 
                      ? "La plateforme est actuellement en mode maintenance. Les utilisateurs ne peuvent pas accéder au site."
                      : "La plateforme fonctionne normalement."
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
