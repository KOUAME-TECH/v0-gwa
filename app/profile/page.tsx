import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Briefcase, GraduationCap, Link2, Mail, Phone, Star, Users, ShoppingBag, Award, TrendingUp, MessageSquare, Calendar } from 'lucide-react'

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navigation />

      <main className="flex-1 py-8">
        <div className="container px-4 max-w-7xl">
          {/* Profile Header */}
          <Card className="mb-6">
            <CardContent className="p-0">
              {/* Cover Image */}
              <div className="h-48 bg-gradient-to-r from-primary via-secondary to-accent rounded-t-lg" />
              
              {/* Profile Info */}
              <div className="px-6 pb-6">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16 relative">
                  <Avatar className="h-32 w-32 border-4 border-background">
                    <AvatarImage src="/professional-african-woman.png" />
                    <AvatarFallback>AM</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mt-4 md:mt-0">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">Amina Mensah</h1>
                        <p className="text-lg text-muted-foreground mb-3">Founder & CEO at TechHub Africa | Digital Innovation Strategist</p>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>Accra, Ghana</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-4 w-4" />
                            <span>Technology</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>2,847 connections</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                        <Button variant="outline">Connect</Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">156</div>
                    <div className="text-sm text-muted-foreground">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-secondary">2.8K</div>
                    <div className="text-sm text-muted-foreground">Connections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">42</div>
                    <div className="text-sm text-muted-foreground">Recommendations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">4.9</div>
                    <div className="text-sm text-muted-foreground">Rating</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* About */}
              <Card>
                <CardHeader>
                  <CardTitle>À propos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    Passionate about leveraging technology to drive economic growth across Africa. 10+ years of experience in digital transformation, startup ecosystem development, and innovation strategy. Founded TechHub Africa to empower the next generation of African entrepreneurs through mentorship, funding, and market access.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="secondary">Digital Innovation</Badge>
                    <Badge variant="secondary">Entrepreneurship</Badge>
                    <Badge variant="secondary">Fintech</Badge>
                    <Badge variant="secondary">Strategy</Badge>
                    <Badge variant="secondary">Leadership</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Experience */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Expérience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">Founder & CEO</h3>
                      <p className="text-sm text-muted-foreground">TechHub Africa</p>
                      <p className="text-xs text-muted-foreground mt-1">2019 - Présent · 6 ans</p>
                      <p className="text-sm mt-2">Leading West Africa's premier technology incubator, supporting 100+ startups with combined valuation of $50M+</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">Director of Innovation</h3>
                      <p className="text-sm text-muted-foreground">Pan-African Bank Group</p>
                      <p className="text-xs text-muted-foreground mt-1">2015 - 2019 · 4 ans</p>
                      <p className="text-sm mt-2">Spearheaded digital transformation initiatives across 12 African markets</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-6 w-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">Senior Business Consultant</h3>
                      <p className="text-sm text-muted-foreground">McKinsey & Company</p>
                      <p className="text-xs text-muted-foreground mt-1">2012 - 2015 · 3 ans</p>
                      <p className="text-sm mt-2">Advised Fortune 500 companies on market entry strategies in Africa</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Education */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Formation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">MBA - Business Administration</h3>
                      <p className="text-sm text-muted-foreground">Harvard Business School</p>
                      <p className="text-xs text-muted-foreground mt-1">2010 - 2012</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">BSc Computer Science</h3>
                      <p className="text-sm text-muted-foreground">University of Ghana</p>
                      <p className="text-xs text-muted-foreground mt-1">2006 - 2010</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Recommandations (42)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 pb-4 border-b last:border-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`/professional-person.png?height=48&width=48&query=professional person ${i}`} />
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-bold">Kwame Osei</h4>
                            <p className="text-sm text-muted-foreground">CEO at FinTech Solutions</p>
                          </div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className="h-4 w-4 fill-accent text-accent" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          "Amina's strategic vision and deep understanding of African markets was instrumental in our expansion..."
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Informations de contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>amina.mensah@techhub.africa</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>+233 24 123 4567</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <a href="#" className="text-primary hover:underline">techhub.africa</a>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Accra, Ghana</span>
                  </div>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle>Compétences principales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { skill: "Digital Strategy", endorsements: 89 },
                      { skill: "Entrepreneurship", endorsements: 76 },
                      { skill: "Business Development", endorsements: 68 },
                      { skill: "Innovation Management", endorsements: 54 },
                      { skill: "Fintech", endorsements: 47 }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.skill}</span>
                        <Badge variant="secondary">{item.endorsements}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Réalisations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Award className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Top 40 Under 40</p>
                      <p className="text-xs text-muted-foreground">Forbes Africa 2023</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Innovation Leader</p>
                      <p className="text-xs text-muted-foreground">African Tech Summit 2022</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Mentor of the Year</p>
                      <p className="text-xs text-muted-foreground">Ghana Startup Awards 2021</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Languages */}
              <Card>
                <CardHeader>
                  <CardTitle>Langues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>English</span>
                    <Badge variant="outline">Native</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>French</span>
                    <Badge variant="outline">Fluent</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Twi</span>
                    <Badge variant="outline">Native</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Swahili</span>
                    <Badge variant="outline">Intermediate</Badge>
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
