import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/notifications — liste
 * PATCH /api/notifications — mark read (id ou all)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const unreadOnly = request.nextUrl.searchParams.get("unread") === "1"
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 50), 100)

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (unreadOnly) query = query.eq("is_read", false)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const unreadCount =
      data?.filter((n) => !n.is_read && !n.read).length ?? 0

    return NextResponse.json({
      notifications: data ?? [],
      unread_count: unreadCount,
    })
  } catch (err) {
    console.error("[api/notifications GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const id = body?.id as string | undefined
    const all = !!body?.all

    if (all) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, marked: "all" })
    }

    if (!id) {
      return NextResponse.json({ error: "id ou all requis" }, { status: 400 })
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read: true })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, marked: id })
  } catch (err) {
    console.error("[api/notifications PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
