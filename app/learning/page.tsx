"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, GraduationCap, Clock, Users, Star, BookOpen, Loader2 } from 'lucide-react'
import Link from "next/link"
import Image from "next/image"

interface Course {
  id: string
  title: string
  slug: string
  description: string
  thumbnail_url: string
  category: string
  level: string
  duration_minutes: number
  instructor_name: string
  is_free: boolean
  price: number
  enrollments_count: number
  rating: number
  is_published: boolean
}

export default function LearningPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  
  const supabase = createClient()

  useEffect(() => {
    loadCourses()
  }, [selectedCategory])

  async function loadCourses() {
    setLoading(true)
    
    let query = supabase
      .from('courses')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory)
    }

    const { data } = await query

    if (data) {
      setCourses(data)
    }
    setLoading(false)
  }

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const categories = [...new Set(courses.map(c => c.category))].filter(Boolean)

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h`
    return `${minutes}min`
  }

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      debutant: 'Debutant',
      intermediaire: 'Intermediaire',
      avance: 'Avance'
    }
    return labels[level] || level
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12">
          <div className="container px-4 text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Centre de Formation GWA</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Developpez vos competences avec nos formations en agriculture, artisanat, 
              gestion et marketing adaptees au contexte africain
            </p>
            
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une formation..."
                  className="pl-10 h-12"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Courses */}
        <section className="py-8">
          <div className="container px-4">
            {/* Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
              <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Toutes
                </TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger 
                    key={cat} 
                    value={cat}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Aucune formation trouvée</h3>
                <p className="text-muted-foreground">
                  De nouvelles formations seront bientôt disponibles
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => (
                  <Link key={course.id} href={`/formations/${course.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-all group overflow-hidden">
                      <div className="relative aspect-video bg-muted">
                        {course.thumbnail_url ? (
                          <Image
                            src={course.thumbnail_url || "/placeholder.svg"}
                            alt={course.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        
                        {course.is_free && (
                          <Badge className="absolute top-2 left-2 bg-green-600">
                            Gratuit
                          </Badge>
                        )}
                        
                        <Badge className="absolute top-2 right-2" variant="secondary">
                          {getLevelLabel(course.level)}
                        </Badge>
                      </div>

                      <CardContent className="p-4">
                        <Badge variant="outline" className="mb-2">
                          {course.category}
                        </Badge>
                        
                        <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                          {course.title}
                        </h3>
                        
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {course.description}
                        </p>

                        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDuration(course.duration_minutes)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {course.enrollments_count || 0}
                          </div>
                          {course.rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              {course.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="p-4 pt-0 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Par {course.instructor_name}</p>
                        </div>
                        <p className="font-bold text-primary">
                          {course.is_free ? 'Gratuit' : `${course.price.toLocaleString()} FCFA`}
                        </p>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
