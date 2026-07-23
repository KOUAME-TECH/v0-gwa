import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CommentSubmitError,
  toggleCommentLike,
} from "@/lib/comments/feed-comments"

/**
 * POST /api/comments/like — body JSON { commentId, type?: "post"|"product" }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: "Connectez-vous pour aimer un commentaire." },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const commentId = String(body.commentId || "").trim()
    const type = body.type === "product" ? "product" : "post"
    if (!commentId) {
      return NextResponse.json({ error: "Commentaire introuvable." }, { status: 400 })
    }

    const result = await toggleCommentLike(supabase, user.id, commentId, type)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CommentSubmitError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error("[api/comments/like]", err)
    return NextResponse.json(
      { error: "Une erreur est survenue. Réessayez." },
      { status: 500 },
    )
  }
}
