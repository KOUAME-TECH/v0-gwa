"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(isInStandaloneMode)

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Check if user already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      // Show again after 7 days
      if ((now.getTime() - dismissedDate.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show our custom prompt after a delay
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // For iOS, show prompt after a delay if not in standalone mode
    if (isIOSDevice && !isInStandaloneMode) {
      setTimeout(() => setShowPrompt(true), 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden animate-slide-up">
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Installer GWA</h3>
              {isIOS ? (
                <p className="text-xs text-muted-foreground">
                  Appuyez sur <span className="inline-flex items-center"><Download className="h-3 w-3 mx-1" /></span> puis "Sur l'ecran d'accueil" pour installer l'app
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Installez l'application pour un acces rapide et une meilleure experience
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {!isIOS && deferredPrompt && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-transparent"
                onClick={handleDismiss}
              >
                Plus tard
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleInstall}
              >
                <Download className="h-4 w-4 mr-2" />
                Installer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
