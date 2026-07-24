import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CommentSubmitError,
  loadFeedComments,
  submitFeedComment,
  type FeedCommentTarget,
} from "@/lib/comments/feed-comments"
import { validateAudioFile } from "@/lib/media/compress"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { assertSameOrigin } from "@/lib/security/csrf"
import { commentTextSchema } from "@/lib/security/validation"

/** GET /api/comments?type=post|product&id=uuid */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_GENERAL")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const type = request.nextUrl.searchParams.get("type")
    const id = request.nextUrl.searchParams.get("id")
    if (type !== "post" && type !== "product") {
      return NextResponse.json({ error: "type invalide" }, { status: 400 })
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const comments = await loadFeedComments(supabase, { type, id }, user?.id)
    return NextResponse.json({ comments })
  } catch (err) {
    console.error("[api/comments GET]", err)
    return NextResponse.json({ error: "Impossible de charger les commentaires" }, { status: 500 })
  }
}

/** POST /api/comments — multipart: type, id, text?, audio? */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("MESSAGE_SEND")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de commentaires. Réessaie dans une minute." },
        { status: 429 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Connectez-vous pour commenter" }, { status: 401 })
    }

    const form = await request.formData()
    const type = form.get("type")?.toString()
    const id = form.get("id")?.toString()
    const rawText = form.get("text")?.toString() ?? ""
    const parsedText = commentTextSchema.safeParse(rawText)
    const text = parsedText.success ? parsedText.data : ""
    const audioEntry = form.get("audio")

    const parentCommentId = form.get("parentCommentId")?.toString() || null
    if (parentCommentId && !/^[0-9a-f-]{36}$/i.test(parentCommentId)) {
      return NextResponse.json({ error: "parent invalide" }, { status: 400 })
    }

    if (type !== "post" && type !== "product") {
      return NextResponse.json({ error: "type invalide" }, { status: 400 })
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }

    let audioFile: File | null = null
    if (audioEntry instanceof File && audioEntry.size > 0) {
      const check = validateAudioFile(audioEntry)
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 })
      }
      audioFile = audioEntry
    }

    const target: FeedCommentTarget = { type, id }
    const result = await submitFeedComment(supabase, {
      target,
      userId: user.id,
      text,
      audioFile,
      parentCommentId: parentCommentId || null,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CommentSubmitError) {
      const status =
        err.code === "AUTH"
          ? 401
          : err.code === "VALIDATION"
            ? 400
            : err.code === "SCHEMA"
              ? 503
              : 500
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    console.error("[api/comments POST]", err)
    return NextResponse.json({ error: "Erreur lors de l'envoi du commentaire" }, { status: 500 })
  }
}
