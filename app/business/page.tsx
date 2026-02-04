import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BarChart3, TrendingUp, ShoppingCart, Users, DollarSign, Package, Eye, MessageSquare, Star, ArrowUp, ArrowDown, Download, Calendar, Bell, Settings } from 'lucide-react'

export default function BusinessDashboard() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navigation />

      <main className="flex-1 py-8">
        <div className="container px-4 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Tableau de bord entreprise</h1>
              <p className="text-muted-foreground">Bienvenue, TechHub Africa</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Derniers 30 jours
              </Button>
              <Button variant="outline" size="icon">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Revenus totaux</p>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <h2 className="text-3xl font-bold">$24,580</h2>
                  <div className="flex items-center text-sm text-green-600 mb-1">
                    <ArrowUp className="h-4 w-4" />
                    <span>12.5%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">vs mois précédent</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Commandes</p>
                  <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-secondary" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <h2 className="text-3xl font-bold">342</h2>
                  <div className="flex items-center text-sm text-green-600 mb-1">
                    <ArrowUp className="h-4 w-4" />
                    <span>8.2%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">127 en attente</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Clients actifs</p>
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <h2 className="text-3xl font-bold">1,847</h2>
                  <div className="flex items-center text-sm text-green-600 mb-1">
                    <ArrowUp className="h-4 w-4" />
                    <span>23.1%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">+156 ce mois</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Note moyenne</p>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <h2 className="text-3xl font-bold">4.8</h2>
                  <div className="flex items-center text-sm text-green-600 mb-1">
                    <ArrowUp className="h-4 w-4" />
                    <span>0.3</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">238 avis</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              {/* Revenue Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Aperçu des revenus</CardTitle>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="revenue" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="revenue">Revenus</TabsTrigger>
                      <TabsTrigger value="orders">Commandes</TabsTrigger>
                      <TabsTrigger value="customers">Clients</TabsTrigger>
                    </TabsList>
                    <TabsContent value="revenue" className="mt-6">
                      <div className="h-[300px] flex items-end justify-between gap-2">
                        {[65, 78, 82, 70, 85, 92, 88, 95, 87, 90, 98, 100].map((height, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div 
                              className="w-full bg-primary rounded-t-lg hover:bg-primary/80 transition-colors cursor-pointer"
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][i]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="orders" className="mt-6">
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Graphique des commandes
                      </div>
                    </TabsContent>
                    <TabsContent value="customers" className="mt-6">
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Graphique des clients
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card>
                <CardHeader>
                  <CardTitle>Commandes récentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { id: '#3847', customer: 'Kofi Mensah', product: 'Formation Marketing Digital', amount: '$89.00', status: 'completed' },
                      { id: '#3846', customer: 'Fatou Diop', product: 'Consultation Business', amount: '$250.00', status: 'pending' },
                      { id: '#3845', customer: 'James Okonkwo', product: 'Package Startup Premium', amount: '$499.00', status: 'completed' },
                      { id: '#3844', customer: 'Sarah Ahmed', product: 'Cours Python', amount: '$129.00', status: 'processing' },
                      { id: '#3843', customer: 'Michael Banda', product: 'Mentorat 1-on-1', amount: '$150.00', status: 'completed' }
                    ].map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/.jpg?height=40&width=40&query=${order.customer}`} />
                            <AvatarFallback>{order.customer.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{order.customer}</p>
                            <p className="text-sm text-muted-foreground">{order.product}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{order.amount}</p>
                          <Badge 
                            variant={
                              order.status === 'completed' ? 'default' : 
                              order.status === 'pending' ? 'secondary' : 
                              'outline'
                            }
                            className="mt-1"
                          >
                            {order.status === 'completed' ? 'Complété' : 
                             order.status === 'pending' ? 'En attente' : 
                             'Traitement'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - 1/3 width */}
            <div className="space-y-6">
              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produits populaires
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: 'Formation Marketing Digital', sales: 89, revenue: '$7,921' },
                    { name: 'Package Startup Premium', sales: 54, revenue: '$26,946' },
                    { name: 'Consultation Business', sales: 47, revenue: '$11,750' },
                    { name: 'Cours Python', sales: 38, revenue: '$4,902' }
                  ].map((product, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-sm font-bold text-primary">{product.revenue}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(product.sales / 89) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{product.sales} ventes</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Customer Reviews */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Avis récents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="pb-4 border-b last:border-0">
                      <div className="flex items-start gap-3 mb-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`/diverse-customers.png?height=32&width=32&query=customer ${i}`} />
                          <AvatarFallback>U{i}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium">Client {i}</p>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className="h-3 w-3 fill-accent text-accent" />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Excellent service et formation de qualité...
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline">
                    <Package className="h-4 w-4 mr-2" />
                    Ajouter un produit
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Messages clients
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Voir analyses
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Paramètres
                  </Button>
                </CardContent>
              </Card>

              {/* Regional Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance régionale</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { region: 'Afrique de l\'Ouest', percentage: 45 },
                    { region: 'Afrique de l\'Est', percentage: 28 },
                    { region: 'Afrique Australe', percentage: 15 },
                    { region: 'Afrique du Nord', percentage: 12 }
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{item.region}</span>
                        <span className="text-sm text-muted-foreground">{item.percentage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
