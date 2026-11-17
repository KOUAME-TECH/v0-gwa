"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type UserContextValue = {
  user: User | null
  isLoading: boolean
  error: boolean
  refresh: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => {
    setIsLoading(true)
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let generation = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    async function loadUser() {
      const current = ++generation
      try {
        const { data, error: authError } = await supabase.auth.getUser()
        if (!active || current !== generation) return
        if (process.env.NODE_ENV === "development") {
          console.debug("[auth] getUser", {
            hasUser: Boolean(data.user),
            error: authError?.name ?? null,
          })
        }
        setUser(data.user)
        setError(Boolean(!data.user && authError && authError.name !== "AuthSessionMissingError"))
      } catch {
        if (!active || current !== generation) return
        setUser(null)
        setError(true)
      } finally {
        if (active && current === generation) setIsLoading(false)
      }
    }

    void loadUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[auth] état de session", {
          event,
          hasSession: Boolean(session),
          hasUser: Boolean(session?.user),
        })
      }
      if (event === "SIGNED_OUT") {
        generation++
        clearTimeout(timer)
        setUser(null)
        setError(false)
        setIsLoading(false)
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        generation++
        clearTimeout(timer)
        setUser(null)
        setIsLoading(true)
        timer = setTimeout(() => void loadUser(), 0)
      }
    })
    return () => {
      active = false
      generation++
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [revision])

  return (
    <UserContext.Provider value={{ user, isLoading, error, refresh }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error("useUser doit être utilisé dans UserProvider")
  return context
}
