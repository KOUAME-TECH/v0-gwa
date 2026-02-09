"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Mail, RefreshCw, AlertTriangle, Inbox, ArrowRight } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

export default function SignUpSuccessPage() {
  const [email, setEmail] = useState("")
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  // Recuperer l'email depuis localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem("gwa_signup_email")
    if (savedEmail) {
      setEmail(savedEmail)
      // Nettoyer le localStorage apres recuperation
      localStorage.removeItem("gwa_signup_email")
    }
  }, [])

  const handleResendEmail = async () => {
    if (!email) return
    
    setIsResending(true)
    setResendError(null)
    setResendSuccess(false)
    
    const supabase = createClient()
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || 
          `${window.location.origin}/dashboard`,
      }
    })
    
    if (error) {
      setResendError(error.message)
    } else {
      setResendSuccess(true)
    }
    
    setIsResending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Inscription réussie !</CardTitle>
          <CardDescription>
            Votre compte GWA a été créé avec succès
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Mail className="h-5 w-5" />
              <span className="font-medium">Verifiez votre email</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Nous avons envoye un email de confirmation a votre adresse. Cliquez sur le lien dans l'email pour activer votre compte.
            </p>
          </div>
          
          <Alert className="text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Important :</strong> L'email peut mettre quelques minutes a arriver. Verifiez votre dossier <strong>spam</strong> ou <strong>courrier indesirable</strong>. Si vous ne recevez toujours pas l'email, demandez a l'administrateur de desactiver la confirmation email.
            </AlertDescription>
          </Alert>

          <Alert className="text-left border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm text-orange-800">
              <strong>Mode developpement :</strong> Si les emails ne fonctionnent pas, l'administrateur peut desactiver la confirmation email dans Supabase Dashboard : <strong>Authentication &gt; Providers &gt; Email &gt; Confirm email = OFF</strong>
            </AlertDescription>
          </Alert>

          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Inbox className="h-5 w-5" />
              <span className="text-sm font-medium">Email non recu ?</span>
            </div>
            
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-center"
              />
              <Button 
                onClick={handleResendEmail} 
                variant="outline" 
                className="w-full bg-transparent"
                disabled={isResending || !email}
              >
                {isResending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renvoyer l'email de confirmation
                  </>
                )}
              </Button>
            </div>
            
            {resendSuccess && (
              <p className="text-sm text-primary">
                Email renvoye avec succes ! Verifiez votre boite de reception.
              </p>
            )}
            
            {resendError && (
              <p className="text-sm text-destructive">
                Erreur: {resendError}
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Deja confirme votre email ?
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/auth/login">
              <ArrowRight className="h-4 w-4 mr-2" />
              Se connecter
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">
              Retour a l'accueil
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
