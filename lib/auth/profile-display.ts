import type { User } from "@supabase/supabase-js"

export type DisplayProfile = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
  rating: number | null
  phone?: string | null
  phone_verified?: boolean | null
  linked_email?: string | null
}

export function profileForAuthenticatedUser(
  user: Pick<User, "id" | "email">,
  profile: DisplayProfile | null,
): DisplayProfile {
  if (profile && profile.id === user.id) {
    return { ...profile, email: user.email || profile.email || "" }
  }
  return {
    id: user.id,
    full_name: "",
    email: user.email || "",
    avatar_url: null,
    bio: null,
    user_type: null,
    city: null,
    country: null,
    is_verified: false,
    rating: null,
  }
}
