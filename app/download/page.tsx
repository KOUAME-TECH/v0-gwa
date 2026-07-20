"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Smartphone, Monitor, Share, Plus, ChevronRight, Check, Wifi, WifiOff, Bell, ShoppingBag } from "lucide-react"

export default function DownloadPage() {
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop" | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase()
    if (/android/.test(ua)) {
      setPlatform("android")
    } else if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios")
    } else {
      setPlatform("desktop")
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
    setCanInstall(false)
  }

  const features = [
    { icon: WifiOff, title: "Mode hors-ligne", desc: "Utilisez l'app sans connexion" },
    { icon: Bell, title: "Notifications", desc: "Recevez des alertes en temps reel" },
    { icon: ShoppingBag, title: "Acces rapide", desc: "Lancez depuis l'ecran d'accueil" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--gwa-primary,#1F5C2E)]/10 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container flex items-center h-14 px-4">
          <Link href="/profil" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
            <span>Retour</span>
          </Link>
        </div>
      </header>

      <main className="container px-4 py-8 max-w-lg mx-auto">
        {/* Hero */}
        <div className="text-center mb-8">
          <img
            src="/icon-192.png"
            alt="GWA"
            width={80}
            height={80}
            className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold mb-2">Installer GWA</h1>
          <p className="text-muted-foreground">
            Ajoutez GWA a votre ecran d'accueil pour un acces rapide
          </p>
          <Badge variant="secondary" className="mt-2">
            Version 1.0.0 - Gratuit
          </Badge>
        </div>

        {/* Already installed */}
        {isInstalled && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-700">
                <Check className="h-6 w-6" />
                <div>
                  <p className="font-medium">GWA est deja installe!</p>
                  <p className="text-sm text-green-600">Vous pouvez le lancer depuis votre ecran d'accueil</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Install button for Android/Desktop with prompt */}
        {canInstall && !isInstalled && (
          <Button onClick={handleInstall} size="lg" className="w-full mb-6 h-14 text-lg bg-[#2F7D32] hover:bg-[#256427]">
            <Download className="h-5 w-5 mr-2" />
            Installer GWA
          </Button>
        )}

        {/* Platform-specific instructions */}
        {!isInstalled && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {platform === "android" && <Smartphone className="h-5 w-5" />}
                {platform === "ios" && <Smartphone className="h-5 w-5" />}
                {platform === "desktop" && <Monitor className="h-5 w-5" />}
                Instructions d'installation
              </CardTitle>
              <CardDescription>
                {platform === "android" && "Pour Android (Chrome)"}
                {platform === "ios" && "Pour iPhone/iPad (Safari)"}
                {platform === "desktop" && "Pour ordinateur (Chrome/Edge)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {platform === "android" && (
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">1</span>
                    <span>Ouvrez le menu (3 points en haut a droite)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">2</span>
                    <span>Appuyez sur "Installer l'application" ou "Ajouter a l'ecran d'accueil"</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">3</span>
                    <span>Confirmez l'installation</span>
                  </li>
                </ol>
              )}

              {platform === "ios" && (
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">1</span>
                    <div className="flex items-center gap-2">
                      <span>Appuyez sur l'icone</span>
                      <Share className="h-5 w-5" />
                      <span>(Partager)</span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">2</span>
                    <div className="flex items-center gap-2">
                      <span>Faites defiler et appuyez sur</span>
                      <Plus className="h-5 w-5" />
                      <span>"Sur l'ecran d'accueil"</span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">3</span>
                    <span>Appuyez sur "Ajouter" en haut a droite</span>
                  </li>
                </ol>
              )}

              {platform === "desktop" && (
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">1</span>
                    <span>Cliquez sur l'icone d'installation dans la barre d'adresse (a droite)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">2</span>
                    <span>Cliquez sur "Installer"</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2F7D32] text-white flex items-center justify-center text-sm">3</span>
                    <span>L'app s'ouvrira dans une nouvelle fenetre</span>
                  </li>
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <div className="space-y-3 mb-8">
          <h2 className="font-semibold text-lg">Pourquoi installer l'app?</h2>
          {features.map((feature) => (
            <div key={feature.title} className="flex items-center gap-4 p-3 bg-card rounded-lg border">
              <div className="w-10 h-10 rounded-full bg-[#2F7D32]/10 flex items-center justify-center">
                <feature.icon className="h-5 w-5 text-[#2F7D32]" />
              </div>
              <div>
                <p className="font-medium">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* App info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taille</span>
              <span>{"<"} 5 Mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compatibilite</span>
              <span>Android 8+, iOS 12+</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Langues</span>
              <span>Francais</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Editeur</span>
              <span>KOUAME CORPORATION</span>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button variant="outline" className="w-full">
              Continuer sur le web
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
