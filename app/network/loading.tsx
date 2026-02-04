import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function NetworkLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation Skeleton */}
      <div className="border-b">
        <div className="container px-4 py-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="bg-gradient-to-br from-primary/5 to-secondary/5 py-12 border-b">
          <div className="container px-4">
            <div className="max-w-3xl space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-full max-w-xl" />
              <div className="flex gap-3">
                <Skeleton className="h-11 flex-1" />
                <Skeleton className="h-11 w-24" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Skeleton */}
        <section className="border-b bg-muted/30 py-4">
          <div className="container px-4">
            <div className="flex flex-wrap gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-32" />
              ))}
            </div>
          </div>
        </section>

        {/* Content Skeleton */}
        <div className="container px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
