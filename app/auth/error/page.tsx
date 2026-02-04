"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "unknown_error"
  const message = searchParams.get("message") || "Une erreur inconnue s'est produite"

  const errorMessages: Record<string, { title: string; description: string }> = {
    access_denied: {
      title: "Acces refuse",
      description: "L'acces a votre compte a ete refuse. Veuillez reessayer."
    },
    invalid_request: {
      title: "Requete invalide",
      description: "La requete d'authentification est invalide ou a expire."
    },
    exchange_error: {
      title: "Erreur de verification",
      description: "Impossible de verifier votre email. Le lien a peut-etre expire."
    },
    server_error: {
      title: "Erreur serveur",
      description: "Une erreur serveur s'est produite. Veuillez reessayer plus tard."
    },
    unknown_error: {
      title: "Erreur",
      description: message
    }
  }

  const errorInfo = errorMessages[error] || errorMessages.unknown_error

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-muted p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{errorInfo.title}</CardTitle>
          <CardDescription className="text-base">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Code d'erreur: <code className="bg-background px-2 py-1 rounded">{error}</code>
            </p>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>Si le probleme persiste, veuillez contacter notre support.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/auth/signup">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reessayer l'inscription
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full bg-transparent">
            <Link href="/auth/login">
              Se connecter
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour a l'accueil
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
