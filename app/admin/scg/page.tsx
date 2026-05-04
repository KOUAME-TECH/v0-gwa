"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Shield, Star, TrendingUp, Save, RefreshCw, History,
  AlertTriangle, CheckCircle, Settings, Users, Award
} from "lucide-react"

const defaultWeights = {
  transactions: 25,
  ratings: 20,
  compliance: 20,
  engagement: 15,
  certifications: 10,
  seniority: 10,
}

const badgeLevels = [
  { name: "Diamant", minScore: 900, color: "bg-purple-500", icon: "💎" },
  { name: "Or", minScore: 750, color: "bg-yellow-500", icon: "🥇" },
  { name: "Argent", minScore: 500, color: "bg-gray-400", icon: "🥈" },
  { name: "Bronze", minScore: 250, color: "bg-orange-600", icon: "🥉" },
  { name: "Debutant", minScore: 0, color: "bg-green-600", icon: "🌱" },
]

export default function AdminSCGPage() {
  const [weights, setWeights] = useState(defaultWeights)
  const [thresholds, setThresholds] = useState(badgeLevels)
  const [autoRecalc, setAutoRecalc] = useState(true)
  const [saving, setSaving] = useState(false)

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)

  const handleWeightChange = (key: string, value: number[]) => {
    setWeights(prev => ({ ...prev, [key]: value[0] }))
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 1000))
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration SCG</h1>
          <p className="text-muted-foreground">Score de Confiance Garanti - Parametres et poids</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <History className="h-4 w-4 mr-2" />
            Historique
          </Button>
          <Button onClick={handleSave} disabled={saving || totalWeight !== 100}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {totalWeight !== 100 && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <span>Le total des poids doit etre egal a 100%. Actuel: {totalWeight}%</span>
        </div>
      )}

      <Tabs defaultValue="weights">
        <TabsList>
          <TabsTrigger value="weights">Poids des criteres</TabsTrigger>
          <TabsTrigger value="badges">Niveaux badges</TabsTrigger>
          <TabsTrigger value="settings">Parametres</TabsTrigger>
        </TabsList>

        <TabsContent value="weights" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Poids des 6 criteres SCG</CardTitle>
              <CardDescription>
                Ajustez l'importance relative de chaque critere dans le calcul du score (total = 100%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(weights).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="capitalize">{key.replace("_", " ")}</Label>
                    <span className="font-mono font-bold">{value}%</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(v) => handleWeightChange(key, v)}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {key === "transactions" && "Nombre et valeur des transactions completees"}
                    {key === "ratings" && "Moyenne des notes recues (1-5 etoiles)"}
                    {key === "compliance" && "Respect des delais, qualite, litiges"}
                    {key === "engagement" && "Activite sur la plateforme, reponses, partages"}
                    {key === "certifications" && "Documents verifies, certifications obtenues"}
                    {key === "seniority" && "Anciennete sur la plateforme"}
                  </p>
                </div>
              ))}

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <Badge variant={totalWeight === 100 ? "default" : "destructive"}>
                    {totalWeight}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Seuils des badges</CardTitle>
              <CardDescription>Score minimum requis pour chaque niveau de badge</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {thresholds.map((level, idx) => (
                <div key={level.name} className="flex items-center gap-4 p-4 rounded-lg border">
                  <div className={`w-12 h-12 rounded-full ${level.color} flex items-center justify-center text-2xl`}>
                    {level.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{level.name}</p>
                    <p className="text-sm text-muted-foreground">Score minimum</p>
                  </div>
                  <Input
                    type="number"
                    value={level.minScore}
                    onChange={(e) => {
                      const newThresholds = [...thresholds]
                      newThresholds[idx].minScore = parseInt(e.target.value) || 0
                      setThresholds(newThresholds)
                    }}
                    className="w-24 text-center"
                    min={0}
                    max={1000}
                  />
                  <span className="text-muted-foreground">/ 1000</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parametres generaux</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Recalcul automatique</p>
                  <p className="text-sm text-muted-foreground">Recalculer les scores apres chaque transaction</p>
                </div>
                <Switch checked={autoRecalc} onCheckedChange={setAutoRecalc} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Score visible publiquement</p>
                  <p className="text-sm text-muted-foreground">Afficher le score sur les profils vendeurs</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notifications de changement</p>
                  <p className="text-sm text-muted-foreground">Notifier les utilisateurs des changements de score</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recalculer tous les scores (batch)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
