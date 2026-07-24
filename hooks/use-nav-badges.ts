"use client"

import { useEffect, useMemo } from "react"
import { useSyncExternalStore } from "react"
import {
  getNavBadgesState,
  getServerNavBadgesState,
  refreshNavBadges,
  retainNavBadges,
  subscribeNavBadges,
} from "@/lib/nav/badges-store"

export type UseNavBadgesOptions = {
  /** When false, read last snapshot but do not keep polling/realtime alive. Default true. */
  enabled?: boolean
}

/**
 * Shared nav badges — one load + 90s poll (tab visible) + CART / notifs / orders events.
 * Dedupes auth.getUser across concurrent refreshes.
 */
export function useNavBadges(options?: UseNavBadgesOptions) {
  const enabled = options?.enabled !== false

  const state = useSyncExternalStore(
    subscribeNavBadges,
    getNavBadgesState,
    getServerNavBadgesState,
  )

  useEffect(() => {
    if (!enabled) return
    return retainNavBadges()
  }, [enabled])

  return useMemo(
    () => ({
      userId: state.userId,
      userType: state.userType,
      unreadNotifs: state.unreadNotifs,
      unreadMessages: state.unreadMessages,
      cartCount: state.cartCount,
      activeOrders: state.activeOrders,
      loading: state.loading,
      refresh: refreshNavBadges,
    }),
    [state],
  )
}
