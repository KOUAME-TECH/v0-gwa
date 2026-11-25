import Link from "next/link"
import { readServerSession } from "@/lib/auth/server-session"
import { loadOwnProfile, toDisplayedProfile } from "@/lib/profile/self"
import ProfilScreen from "./profil-screen"

export const dynamic = "force-dynamic"

function SignedOut() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-5 gwa-shell-page">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Connectez-vous</h2>
        <p className="text-neutral-500 text-sm mb-6">
          pour accéder à votre espace Moi
        </p>
        <Link
          href="/auth/login?redirect=/profil"
          className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground"
        >
          Se connecter
        </Link>
      </div>
    </div>
  )
}

export default async function ProfilPage() {
  const session = await readServerSession()

  if (session.kind === "unavailable") {
    throw new Error("Session temporairement illisible")
  }

  if (session.kind === "anonymous" || !session.user) {
    return <SignedOut />
  }

  const { profile, partial } = await loadOwnProfile(session.supabase, session.user)

  return <ProfilScreen profile={toDisplayedProfile(profile)} partial={partial} />
}
