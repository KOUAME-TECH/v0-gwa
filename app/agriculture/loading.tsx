import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function AgricultureLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="container px-4 py-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <main className="flex-1">
        <section className="bg-gradient-to-br from-green-50 to-emerald-50 py-16 border-b">
          <div className="container px-4">
            <div className="max-w-3xl space-y-4">
              <Skeleton className="h-12 w-96" />
              <Skeleton className="h-6 w-full max-w-2xl" />
            </div>
          </div>
        </section>

        <div className="container px-4 py-8">
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
