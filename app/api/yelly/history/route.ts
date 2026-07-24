import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"

export const dynamic = "force-dynamic"

/**
 * GET /api/yelly/history — dernier fil Yelly de l'utilisateur connecté.
 */
export async function GET() {
  try {
    const rate = await checkRateLimit("API_GENERAL")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ messages: [], conversationId: null })
    }

    const { data: conv } = await supabase
      .from("yelly_conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conv?.id) {
      return NextResponse.json({ messages: [], conversationId: null })
    }

    const { data: messages } = await supabase
      .from("yelly_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(40)

    return NextResponse.json({
      conversationId: conv.id,
      messages: (messages || []).filter((m) => m.role === "user" || m.role === "assistant"),
    })
  } catch (err) {
    console.error("[api/yelly/history]", err)
    return NextResponse.json({ messages: [], conversationId: null })
  }
}
