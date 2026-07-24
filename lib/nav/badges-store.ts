import { createClient } from "@/lib/supabase/client"
import { CART_CHANGED_EVENT } from "@/lib/cart/events"
import { ORDERS_CHANGED } from "@/hooks/use-active-orders-count"
import { guestCartProductCount } from "@/lib/cart/guest"

export type NavBadgesState = {
  userId: string | null
  userType: string | null
  unreadNotifs: number
  unreadMessages: number
  cartCount: number
  activeOrders: number
  loading: boolean
}

const INITIAL: NavBadgesState = {
  userId: null,
  userType: null,
  unreadNotifs: 0,
  unreadMessages: 0,
  cartCount: 0,
  activeOrders: 0,
  loading: true,
}

const ACTIVE_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "disputed",
] as const

const POLL_MS = 90_000

let state: NavBadgesState = { ...INITIAL }
const listeners = new Set<() => void>()

let retainCount = 0
let started = false
let refreshInFlight: Promise<void> | null = null
/** Dedup concurrent auth.getUser() across store + consumers. */
let getUserInFlight: Promise<{ id: string } | null> | null = null

let authUnsub: (() => void) | null = null
let notifChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function emit() {
  for (const listener of listeners) listener()
}

function setState(partial: Partial<NavBadgesState>) {
  state = { ...state, ...partial }
  emit()
}

export function getNavBadgesState(): NavBadgesState {
  return state
}

export function getServerNavBadgesState(): NavBadgesState {
  return INITIAL
}

export function subscribeNavBadges(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function getUserDeduped(): Promise<{ id: string } | null> {
  if (getUserInFlight) return getUserInFlight
  const supabase = createClient()
  getUserInFlight = (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user ? { id: user.id } : null
    } catch {
      return null
    } finally {
      getUserInFlight = null
    }
  })()
  return getUserInFlight
}

function clearBadges(loading = false) {
  setState({
    userId: null,
    userType: null,
    unreadNotifs: 0,
    unreadMessages: 0,
    cartCount: 0,
    activeOrders: 0,
    loading,
  })
}

export async function refreshNavBadges(): Promise<void> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const supabase = createClient()
      const u = await getUserDeduped()

      if (!u) {
        setState({
          userId: null,
          userType: null,
          unreadNotifs: 0,
          unreadMessages: 0,
          cartCount: guestCartProductCount(),
          activeOrders: 0,
          loading: false,
        })
        return
      }

      const [profileRes, msgRes, notifRes, cartRes, buyRes, sellRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("user_type")
            .eq("id", u.id)
            .maybeSingle(),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .neq("sender_id", u.id),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", u.id)
            .eq("is_read", false),
          supabase
            .from("cart_items")
            .select("id", { count: "exact", head: true })
            .eq("user_id", u.id),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("buyer_id", u.id)
            .in("status", [...ACTIVE_ORDER_STATUSES]),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", u.id)
            .in("status", [...ACTIVE_ORDER_STATUSES]),
        ])

      setState({
        userId: u.id,
        userType: profileRes.data?.user_type ?? null,
        unreadMessages: msgRes.count || 0,
        unreadNotifs: notifRes.count || 0,
        cartCount: cartRes.count || 0,
        activeOrders: (buyRes.count || 0) + (sellRes.count || 0),
        loading: false,
      })
    } catch (err) {
      console.warn("[nav-badges] refresh dégradé", err)
      setState({ loading: false })
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

function onExternalChange() {
  void refreshNavBadges()
}

function onPollTick() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return
  }
  void refreshNavBadges()
}

function onVisibilityChange() {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    void refreshNavBadges()
  }
}

function ensureStarted() {
  if (started || typeof window === "undefined") return
  started = true

  const supabase = createClient()
  void refreshNavBadges()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string } } | null) => {
    getUserInFlight = null
    if (session?.user) {
      setState({ userId: session.user.id })
      void refreshNavBadges()
    } else {
      setState({
        userId: null,
        userType: null,
        unreadNotifs: 0,
        unreadMessages: 0,
        cartCount: guestCartProductCount(),
        activeOrders: 0,
        loading: false,
      })
    }
  })
  authUnsub = () => subscription.unsubscribe()

  notifChannel = supabase
    .channel("nav-notif-lite")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications" },
      onExternalChange,
    )
    .subscribe()

  window.addEventListener("gwa:notifications-updated", onExternalChange)
  window.addEventListener(CART_CHANGED_EVENT, onExternalChange)
  window.addEventListener(ORDERS_CHANGED, onExternalChange)
  document.addEventListener("visibilitychange", onVisibilityChange)

  pollTimer = setInterval(onPollTick, POLL_MS)
}

function tearDown() {
  if (!started) return
  started = false

  authUnsub?.()
  authUnsub = null

  if (notifChannel) {
    try {
      createClient().removeChannel(notifChannel)
    } catch {
      /* ignore */
    }
    notifChannel = null
  }

  if (typeof window !== "undefined") {
    window.removeEventListener("gwa:notifications-updated", onExternalChange)
    window.removeEventListener(CART_CHANGED_EVENT, onExternalChange)
    window.removeEventListener(ORDERS_CHANGED, onExternalChange)
    document.removeEventListener("visibilitychange", onVisibilityChange)
  }

  if (pollTimer != null) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  getUserInFlight = null
  refreshInFlight = null
}

/** Keep the shared store alive while at least one consumer wants live badges. */
export function retainNavBadges(): () => void {
  retainCount += 1
  ensureStarted()
  return () => {
    retainCount = Math.max(0, retainCount - 1)
    if (retainCount === 0) tearDown()
  }
}
