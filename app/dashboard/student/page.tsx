"use client"

import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BookOpen, Award, Briefcase, Calendar, Clock, Star, TrendingUp, Users, FileText, Target } from 'lucide-react'
import Link from "next/link"

export default function StudentDashboard() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30">
        <div className="container py-8 px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Espace Étudiant</h1>
              <p className="text-muted-foreground">Bienvenue dans votre parcours d'apprentissage</p>
            </div>
            <Badge className="text-base px-4 py-2">
              <Star className="mr-2 h-4 w-4" />
              Niveau: Intermédiaire
            </Badge>
          </div>

          {/* Stats rapides */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cours en cours</CardTitle>
                <BookOpen className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">
                  3 à terminer ce mois
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Certifications</CardTitle>
                <Award className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">
                  +2 ce trimestre
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stages disponibles</CardTitle>
                <Briefcase className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">28</div>
                <p className="text-xs text-muted-foreground">
                  Dans votre région
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Heures d'étude</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">156h</div>
                <p className="text-xs text-muted-foreground">
                  +24h cette semaine
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Cours en progression */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mes Cours en Cours</CardTitle>
                    <CardDescription>Continuez votre apprentissage</CardDescription>
                  </div>
                  <Link href="/learning">
                    <Button variant="outline" size="sm">Voir tout</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { title: "Développement Web Complet", instructor: "Dr. Amara Diallo", progress: 75, hours: "8/12h", color: "bg-primary" },
                    { title: "Marketing Digital Avancé", instructor: "Prof. Kwame Mensah", progress: 45, hours: "5/15h", color: "bg-secondary" },
                    { title: "Data Science avec Python", instructor: "Dr. Fatima El-Sayed", progress: 90, hours: "18/20h", color: "bg-accent" },
                  ].map((course, i) => (
                    <div key={i} className="p-4 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{course.title}</h3>
                          <p className="text-sm text-muted-foreground">{course.instructor}</p>
                        </div>
                        <Badge variant="outline">{course.hours}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progression</span>
                          <span className="font-medium">{course.progress}%</span>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                      </div>
                      <Button className="w-full mt-3" size="sm">Continuer le cours</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions rapides */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                  <CardDescription>Accès direct à vos outils</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/learning">
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Explorer les cours
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full justify-start">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Chercher un stage
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Award className="mr-2 h-4 w-4" />
                    Mes certifications
                  </Button>
                  <Link href="/network">
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Trouver un mentor
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Objectifs */}
              <Card>
                <CardHeader>
                  <CardTitle>Objectifs du Mois</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Terminer 3 cours", progress: 66, color: "bg-primary" },
                    { label: "Obtenir 2 certificats", progress: 50, color: "bg-secondary" },
                    { label: "Postuler à 5 stages", progress: 80, color: "bg-accent" },
                  ].map((goal, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{goal.label}</span>
                        <span className="text-muted-foreground">{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Opportunités recommandées */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Opportunités Recommandées</CardTitle>
                  <CardDescription>Bourses et stages adaptés à votre profil</CardDescription>
                </div>
                <Link href="/learning">
                  <Button variant="outline" size="sm">Voir tout</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: "Bourse d'Excellence 2025", org: "Fondation Africaine", type: "Bourse", amount: "5,000 €", deadline: "15 jours" },
                  { title: "Stage Développeur Junior", org: "Tech Hub Lagos", type: "Stage", amount: "Rémunéré", deadline: "1 mois" },
                  { title: "Programme Mentorat IA", org: "AI Research Kenya", type: "Mentorat", amount: "Gratuit", deadline: "20 jours" },
                ].map((opp, i) => (
                  <div key={i} className="p-4 rounded-lg border hover:border-primary transition-all hover:shadow-md cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant={i === 0 ? "default" : "secondary"}>{opp.type}</Badge>
                      <span className="text-xs text-muted-foreground">{opp.deadline}</span>
                    </div>
                    <h3 className="font-semibold mb-1">{opp.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{opp.org}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm font-medium text-primary">{opp.amount}</span>
                      <Button size="sm">Postuler</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
