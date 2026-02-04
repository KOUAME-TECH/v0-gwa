"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Phone, MapPin, Send } from 'lucide-react'

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simuler l'envoi
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSubmitting(false)
    setSubmitted(true)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30 py-16">
        <div className="container max-w-6xl px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Contactez-Nous</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Notre équipe est là pour répondre à toutes vos questions
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Envoyez-nous un message</CardTitle>
                <CardDescription>
                  Nous vous répondrons dans les 24 heures
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <Send className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Message envoyé !</h3>
                    <p className="text-muted-foreground">Nous vous répondrons très bientôt.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom</Label>
                      <Input id="name" placeholder="Votre nom" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="votre@email.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Sujet</Label>
                      <Input id="subject" placeholder="En quoi pouvons-nous vous aider ?" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea id="message" placeholder="Votre message..." rows={5} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Envoi en cours..." : "Envoyer le message"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Email</h3>
                      <p className="text-sm text-muted-foreground">contact@gwa-africa.com</p>
                      <p className="text-sm text-muted-foreground">support@gwa-africa.com</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Téléphone</h3>
                      <p className="text-sm text-muted-foreground">+225 XX XX XX XX XX</p>
                      <p className="text-sm text-muted-foreground">+234 XXX XXX XXXX</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Bureaux</h3>
                      <p className="text-sm text-muted-foreground">Abidjan, Côte d'Ivoire</p>
                      <p className="text-sm text-muted-foreground">Lagos, Nigeria</p>
                      <p className="text-sm text-muted-foreground">Nairobi, Kenya</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
