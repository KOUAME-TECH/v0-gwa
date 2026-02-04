import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function MessagesLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="container px-4 py-4">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <main className="flex-1">
        <div className="container px-4 py-8">
          <Card className="h-[600px] flex">
            <div className="w-80 border-r p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 flex flex-col">
              <div className="border-b p-4">
                <Skeleton className="h-6 w-48" />
              </div>
              <div className="flex-1 p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-2/3" />
                ))}
              </div>
              <div className="border-t p-4">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
