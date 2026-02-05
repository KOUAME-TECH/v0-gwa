import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, ShoppingCart, Heart, Share2, MapPin, Store, Shield, Truck, Package, ArrowLeft, CheckCircle2, MessageCircle } from 'lucide-react'
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function ProductPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="border-b bg-muted/30">
          <div className="container px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Link href="/marketplace" className="text-muted-foreground hover:text-foreground">
                Marketplace
              </Link>
              <span className="text-muted-foreground">/</span>
              <Link href="/marketplace?category=arts" className="text-muted-foreground hover:text-foreground">
                Arts & Crafts
              </Link>
              <span className="text-muted-foreground">/</span>
              <span>Handwoven African Baskets Set</span>
            </div>
          </div>
        </div>

        <div className="container px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-6" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Product Images */}
            <div className="space-y-4">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src="/african-basket-close-up.jpg"
                  alt="Product"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <button
                    key={i}
                    className="aspect-square rounded-lg overflow-hidden bg-muted border-2 hover:border-primary transition-colors"
                  >
                    <img
                      src={`/african-basket-view-.jpg?height=150&width=150&query=african basket view ${i+1}`}
                      alt={`View ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <Badge className="bg-accent text-accent-foreground border-0">
                    Best Seller
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <Heart className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Share2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <h1 className="text-3xl font-bold mb-4">Handwoven African Baskets Set</h1>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${i < 4 ? 'fill-accent text-accent' : 'text-muted'}`}
                      />
                    ))}
                    <span className="font-medium ml-2">4.8</span>
                  </div>
                  <span className="text-muted-foreground">234 reviews</span>
                  <span className="text-muted-foreground">1.2K sold</span>
                </div>

                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-4xl font-bold text-primary">$45.00</span>
                  <span className="text-xl text-muted-foreground line-through">$65.00</span>
                  <Badge variant="destructive">-31% OFF</Badge>
                </div>

                <p className="text-muted-foreground leading-relaxed mb-6">
                  Beautiful handwoven basket set crafted by skilled artisans in Ghana. Each basket is unique and features traditional African patterns. Perfect for storage, decoration, or as a thoughtful gift. Set includes 3 baskets in different sizes.
                </p>
              </div>

              <Separator />

              {/* Seller Info */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="/placeholder.svg?key=k0u6w" />
                  <AvatarFallback>AC</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">Artisan Crafts Ghana</h3>
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Accra, Ghana
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      4.9 seller rating
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/marketplace/seller/artisan-crafts">
                        <Store className="h-4 w-4 mr-2" />
                        Visit Store
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Contact
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Quantity & Actions */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Quantity</label>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon">-</Button>
                    <span className="w-12 text-center font-medium">1</span>
                    <Button variant="outline" size="icon">+</Button>
                    <span className="text-sm text-muted-foreground ml-2">
                      156 pieces available
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1" size="lg">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Add to Cart
                  </Button>
                  <Button variant="outline" size="lg" className="flex-1 bg-transparent">
                    Buy Now
                  </Button>
                </div>
              </div>

              {/* Shipping Info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-1">Free Shipping</h4>
                      <p className="text-sm text-muted-foreground">
                        On orders over $50 within West Africa
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-1">Secure Packaging</h4>
                      <p className="text-sm text-muted-foreground">
                        Carefully packed to ensure safe delivery
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium mb-1">Buyer Protection</h4>
                      <p className="text-sm text-muted-foreground">
                        Full refund if item not as described
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Product Details Tabs */}
          <Tabs defaultValue="description" className="mb-12">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="reviews">Reviews (234)</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-xl font-bold">Product Description</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    These beautiful handwoven baskets are crafted by skilled artisans in Accra, Ghana, using traditional weaving techniques passed down through generations. Each basket is made from sustainable, locally-sourced materials including elephant grass and natural dyes.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    The set includes three baskets in graduated sizes, perfect for organizing your home or displaying as decorative pieces. The intricate geometric patterns are inspired by traditional Ghanaian kente cloth designs.
                  </p>
                  <h4 className="font-bold mt-6">Features:</h4>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Handwoven by skilled artisans</li>
                    <li>Made from sustainable, natural materials</li>
                    <li>Traditional African geometric patterns</li>
                    <li>Set of 3 baskets (Large, Medium, Small)</li>
                    <li>Multi-functional - storage or decoration</li>
                    <li>Each piece is unique</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specifications" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4">Specifications</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { label: "Material", value: "Elephant Grass, Natural Dyes" },
                      { label: "Origin", value: "Accra, Ghana" },
                      { label: "Large Basket", value: "14\" diameter x 10\" height" },
                      { label: "Medium Basket", value: "12\" diameter x 8\" height" },
                      { label: "Small Basket", value: "10\" diameter x 6\" height" },
                      { label: "Weight", value: "2.5 lbs (total set)" },
                      { label: "Care", value: "Wipe clean with damp cloth" },
                      { label: "Certification", value: "Fair Trade Certified" }
                    ].map((spec, i) => (
                      <div key={i} className="flex justify-between py-2 border-b">
                        <span className="font-medium">{spec.label}</span>
                        <span className="text-muted-foreground">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Customer Reviews</h3>
                    <Button>Write a Review</Button>
                  </div>

                  {/* Reviews */}
                  <div className="space-y-6">
                    {[
                      {
                        name: "Sarah M.",
                        rating: 5,
                        date: "2 weeks ago",
                        verified: true,
                        text: "Absolutely beautiful baskets! The craftsmanship is outstanding and they look stunning in my living room. Shipping was fast and packaging was secure."
                      },
                      {
                        name: "John K.",
                        rating: 5,
                        date: "1 month ago",
                        verified: true,
                        text: "Great quality and exactly as described. Love supporting African artisans through GWA. Highly recommend!"
                      },
                      {
                        name: "Amina T.",
                        rating: 4,
                        date: "1 month ago",
                        verified: true,
                        text: "Very nice baskets with authentic patterns. The only reason for 4 stars is that shipping took a bit longer than expected, but worth the wait."
                      }
                    ].map((review, i) => (
                      <div key={i} className="pb-6 border-b last:border-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{review.name}</span>
                              {review.verified && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Verified Purchase
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {Array.from({ length: 5 }).map((_, j) => (
                                  <Star
                                    key={j}
                                    className={`h-4 w-4 ${
                                      j < review.rating ? 'fill-accent text-accent' : 'text-muted'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-muted-foreground">{review.date}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Related Products */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Similar Products</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="hover:border-primary transition-colors">
                  <CardHeader className="p-0">
                    <div className="aspect-square rounded-t-lg overflow-hidden bg-muted">
                      <img
                        src={`/african-craft-.jpg?height=300&width=300&query=african craft ${i}`}
                        alt="Related product"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <h3 className="font-bold mb-2 line-clamp-2">
                      African Handcrafted Item {i + 1}
                    </h3>
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      <span className="text-sm">4.7</span>
                    </div>
                    <span className="text-xl font-bold text-primary">$38.00</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
