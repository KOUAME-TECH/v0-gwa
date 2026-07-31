import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardRoleLoading() {
  return (
    <div className="min-h-screen bg-[#FFF6E5] p-4 pb-24 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  )
}
