"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  ArrowLeft, BookOpen, Clock, Users, Star, Play, Download, CheckCircle2, 
  Award, Lock, FileText, Video, HelpCircle, MessageSquare 
} from "lucide-react"

interface Course {
  id: string
  title: string
  description: string
  long_description: string
  thumbnail_url: string | null
  category: string
  difficulty_level: string
  duration_minutes: number
  is_free: boolean
  price: number
  instructor_name: string
  instructor_bio: string
  instructor_avatar: string | null
  rating: number
  enrolled_count: number
  is_offline_available: boolean
  requirements: string[]
  objectives: string[]
}

interface Module {
  id: string
  title: string
  description: string
  order_index: number
  duration_minutes: number
  content_type: string
  is_free_preview: boolean
}

interface UserProgress {
  progress_percentage: number
  completed_modules: string[]
  last_module_id: string | null
  completed_at: string | null
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Load course
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()

      if (courseData) {
        setCourse(courseData)
      }

      // Load modules
      const { data: modulesData } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', id)
        .order('order_index', { ascending: true })

      if (modulesData) {
        setModules(modulesData)
      }

      // Load user progress
      if (user) {
        const { data: progressData } = await supabase
          .from('user_course_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('course_id', id)
          .single()

        if (progressData) {
          setProgress(progressData)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [id])

  const handleEnroll = async () => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    setEnrolling(true)

    // Create progress entry
    const { error } = await supabase
      .from('user_course_progress')
      .insert({
        user_id: user.id,
        course_id: id,
        progress_percentage: 0,
        completed_modules: [],
      })

    if (!error) {
      setProgress({
        progress_percentage: 0,
        completed_modules: [],
        last_module_id: null,
        completed_at: null
      })

      // Update enrolled count
      await supabase
        .from('courses')
        .update({ enrolled_count: (course?.enrolled_count || 0) + 1 })
        .eq('id', id)
    }

    setEnrolling(false)
  }

  const handleStartModule = (moduleId: string) => {
    router.push(`/formations/${id}/module/${moduleId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Formation introuvable</h3>
            <Link href="/formations">
              <Button>Retour aux formations</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  const isEnrolled = !!progress

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Link href="/formations" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Retour aux formations
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Course Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">{course.category}</Badge>
                <Badge variant="outline">{course.difficulty_level}</Badge>
                {course.is_free && <Badge className="bg-green-500">Gratuit</Badge>}
              </div>
              
              <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
              <p className="text-lg text-muted-foreground mb-4">{course.description}</p>
              
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{course.rating.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{course.enrolled_count} inscrits</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{Math.floor(course.duration_minutes / 60)}h {course.duration_minutes % 60}m</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{modules.length} modules</span>
                </div>
              </div>
            </div>

            {/* Course Image */}
            {course.thumbnail_url && (
              <div className="relative h-64 md:h-96 rounded-lg overflow-hidden mb-8">
                <Image
                  src={course.thumbnail_url || "/placeholder.svg"}
                  alt={course.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Button size="lg" className="gap-2">
                    <Play className="h-5 w-5" />
                    Voir la presentation
                  </Button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Contenu</TabsTrigger>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="instructor">Formateur</TabsTrigger>
                <TabsTrigger value="reviews">Avis</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Programme de la formation</CardTitle>
                    <CardDescription>
                      {modules.length} modules - {Math.floor(course.duration_minutes / 60)}h {course.duration_minutes % 60}m de contenu
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {modules.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Le contenu sera bientot disponible
                      </p>
                    ) : (
                      <Accordion type="single" collapsible className="w-full">
                        {modules.map((module, index) => {
                          const isCompleted = progress?.completed_modules?.includes(module.id)
                          const isLocked = !isEnrolled && !module.is_free_preview
                          
                          return (
                            <AccordionItem key={module.id} value={module.id}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3 text-left">
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    isCompleted ? 'bg-green-100 text-green-600' : 'bg-muted'
                                  }`}>
                                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium">{module.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {module.duration_minutes} min - {module.content_type}
                                    </p>
                                  </div>
                                  {isLocked && <Lock className="h-4 w-4 text-muted-foreground ml-2" />}
                                  {module.is_free_preview && !isEnrolled && (
                                    <Badge variant="secondary" className="ml-2">Apercu gratuit</Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="pl-11 pt-2">
                                  <p className="text-muted-foreground mb-4">{module.description}</p>
                                  {(isEnrolled || module.is_free_preview) && (
                                    <Button size="sm" onClick={() => handleStartModule(module.id)}>
                                      {isCompleted ? "Revoir" : "Commencer"}
                                    </Button>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="description" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="prose max-w-none">
                      <h3 className="text-lg font-semibold mb-4">A propos de cette formation</h3>
                      <p className="text-muted-foreground mb-6">
                        {course.long_description || course.description}
                      </p>

                      {course.objectives && course.objectives.length > 0 && (
                        <>
                          <h4 className="font-semibold mb-3">Ce que vous apprendrez</h4>
                          <ul className="space-y-2 mb-6">
                            {course.objectives.map((obj, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {course.requirements && course.requirements.length > 0 && (
                        <>
                          <h4 className="font-semibold mb-3">Prerequis</h4>
                          <ul className="space-y-2">
                            {course.requirements.map((req, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="instructor" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={course.instructor_avatar || undefined} />
                        <AvatarFallback>{course.instructor_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold">{course.instructor_name}</h3>
                        <p className="text-muted-foreground mt-2">
                          {course.instructor_bio || "Formateur experimente sur la plateforme GWA"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucun avis pour le moment</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="pt-6">
                {/* Progress if enrolled */}
                {isEnrolled && progress && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Votre progression</span>
                      <span className="font-medium">{progress.progress_percentage}%</span>
                    </div>
                    <Progress value={progress.progress_percentage} className="h-3" />
                    {progress.completed_at && (
                      <div className="flex items-center gap-2 mt-3 text-green-600">
                        <Award className="h-5 w-5" />
                        <span className="text-sm font-medium">Formation terminee !</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price */}
                {!isEnrolled && (
                  <div className="text-center mb-6">
                    {course.is_free ? (
                      <span className="text-3xl font-bold text-green-600">Gratuit</span>
                    ) : (
                      <span className="text-3xl font-bold">{course.price.toLocaleString()} FCFA</span>
                    )}
                  </div>
                )}

                {/* Action Button */}
                {isEnrolled ? (
                  <Button className="w-full mb-4" size="lg" onClick={() => {
                    const nextModule = modules.find(m => !progress?.completed_modules?.includes(m.id))
                    if (nextModule) {
                      handleStartModule(nextModule.id)
                    }
                  }}>
                    <Play className="h-5 w-5 mr-2" />
                    Continuer la formation
                  </Button>
                ) : (
                  <Button className="w-full mb-4" size="lg" onClick={handleEnroll} disabled={enrolling}>
                    {enrolling ? "Inscription..." : course.is_free ? "S'inscrire gratuitement" : "S'inscrire maintenant"}
                  </Button>
                )}

                {/* Features */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-muted-foreground" />
                    <span>{Math.floor(course.duration_minutes / 60)}h de video</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <span>{modules.length} modules</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span>Ressources telechargables</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-muted-foreground" />
                    <span>Certificat de completion</span>
                  </div>
                  {course.is_offline_available && (
                    <div className="flex items-center gap-3">
                      <Download className="h-5 w-5 text-muted-foreground" />
                      <span>Disponible hors ligne</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
