"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Search, BookOpen, Clock, Users, Star, Play, ChevronLeft, Sprout, Hammer, TrendingUp, Laptop, Award, X } from "lucide-react"

interface Course {
  id: string
  title: string
  description: string
  thumbnail_url: string | null
  category: string
  difficulty_level: string
  duration_minutes: number
  is_free: boolean
  price: number
  instructor_name: string
  rating: number
  enrolled_count: number
}

interface UserProgress {
  course_id: string
  progress_percentage: number
  completed_at: string | null
}

const categories = [
  { value: "all", label: "Tout", icon: BookOpen },
  { value: "agriculture", label: "Agriculture", icon: Sprout },
  { value: "artisanat", label: "Artisanat", icon: Hammer },
  { value: "business", label: "Business", icon: TrendingUp },
  { value: "digital", label: "Digital", icon: Laptop },
]

export default function FormationsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const { data: coursesData } = await supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })

    if (coursesData) setCourses(coursesData)

    if (user) {
      const { data: progressData } = await supabase
        .from("user_course_progress")
        .select("*")
        .eq("user_id", user.id)

      if (progressData) {
        const progressMap: Record<string, UserProgress> = {}
        progressData.forEach(p => { progressMap[p.course_id] = p })
        setUserProgress(progressMap)
      }
    }

    setLoading(false)
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || course.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const inProgressCount = courses.filter(c => userProgress[c.id] && !userProgress[c.id].completed_at).length
  const completedCount = courses.filter(c => userProgress[c.id]?.completed_at).length

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-br from-[#1e3a5f] to-[#0d1f33]">
        <div className="px-4 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="text-white/80">
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Formations</h1>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <Play className="h-4 w-4 text-white" />
              <span className="text-sm text-white">{inProgressCount} en cours</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <Award className="h-4 w-4 text-white" />
              <span className="text-sm text-white">{completedCount} terminées</span>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une formation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white border-0 rounded-xl"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.value
                  ? "bg-white text-[#1e3a5f]"
                  : "bg-white/20 text-white"
              }`}
            >
              <cat.icon className="h-4 w-4" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-10 w-10 text-[#1e3a5f]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Centre de formation</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Nos formations en agriculture, artisanat et business arrivent bientôt. Inscrivez-vous pour être informé !
            </p>
            {!user && (
              <Link href="/auth/signup">
                <Button className="rounded-xl bg-[#1e3a5f]">Créer mon compte</Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {filteredCourses.length} formation{filteredCourses.length > 1 ? "s" : ""} disponible{filteredCourses.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-4">
              {filteredCourses.map(course => {
                const progress = userProgress[course.id]
                return (
                  <Link 
                    key={course.id} 
                    href={`/formations/${course.id}`}
                    className="flex gap-4 bg-card rounded-2xl p-3 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                      {course.thumbnail_url ? (
                        <Image
                          src={course.thumbnail_url || "/placeholder.svg"}
                          alt={course.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {course.is_free && (
                        <Badge className="absolute top-1 left-1 bg-green-500 text-[10px] px-1.5 py-0">
                          Gratuit
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{course.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.floor(course.duration_minutes / 60)}h{course.duration_minutes % 60 > 0 ? course.duration_minutes % 60 : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {course.enrolled_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {course.rating?.toFixed(1) || "N/A"}
                        </span>
                      </div>
                      {progress ? (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progression</span>
                            <span className="font-medium">{progress.progress_percentage}%</span>
                          </div>
                          <Progress value={progress.progress_percentage} className="h-1.5" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">
                            {course.difficulty_level}
                          </Badge>
                          {!course.is_free && (
                            <span className="text-sm font-semibold text-primary">
                              {course.price.toLocaleString()} FCFA
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
