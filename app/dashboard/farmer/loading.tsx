import { Skeleton } from "@/components/ui/skeleton"

export default function FarmerLoading() {
  return (
    <div className="min-h-screen bg-[#E8F5E9] p-4 pb-24 space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-12 rounded-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-36 rounded-2xl" />
    </div>
  )
}
