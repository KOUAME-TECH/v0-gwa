import { readServerSession } from "@/lib/auth/server-session"
import { loadOwnProfile } from "@/lib/profile/self"
import BuyerDashboard from "./buyer-dashboard"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function BuyerDashboardPage() {
  const session = await readServerSession()

  if (session.kind === "unavailable") {
    throw new Error("Session temporairement illisible")
  }

  if (session.kind === "anonymous" || !session.user) {
    redirect("/auth/login?redirect=/dashboard/buyer")
  }

  const { profile } = await loadOwnProfile(session.supabase, session.user)

  return (
    <BuyerDashboard
      serverUserId={session.user.id}
      initialProfile={{
        full_name: profile.full_name,
        user_type: profile.user_type ?? undefined,
        city: profile.city,
      }}
    />
  )
}
