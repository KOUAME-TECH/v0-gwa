import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function LearningLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="container px-4 py-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/5 to-secondary/5 py-12 border-b">
          <div className="container px-4">
            <div className="max-w-3xl space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-full max-w-xl" />
            </div>
          </div>
        </section>

        <div className="container px-4 py-8">
          <div className="space-y-8">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-40 w-full rounded-t-lg" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
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
