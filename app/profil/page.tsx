import { redirect } from "next/navigation"
import { readServerSession } from "@/lib/auth/server-session"
import { loadOwnProfile, toDisplayedProfile } from "@/lib/profile/self"
import ProfilScreen from "./profil-screen"

export const dynamic = "force-dynamic"

export default async function ProfilPage() {
  const session = await readServerSession()

  if (session.kind === "unavailable") {
    throw new Error("Session temporairement illisible")
  }

  // Défense en profondeur : proxy.ts redirige déjà (307) avant d'arriver ici.
  if (session.kind === "anonymous" || !session.user) {
    redirect("/auth/login?redirect=%2Fprofil")
  }

  const { profile, partial } = await loadOwnProfile(session.supabase, session.user)

  return <ProfilScreen profile={toDisplayedProfile(profile)} partial={partial} />
}
