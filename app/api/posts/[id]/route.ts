import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Ctx = { params: Promise<{ id: string }> }

/**
 * DELETE /api/posts/[id] — suppression d'une publication par son auteur.
 * Vérifie l'authentification + la propriété (author_id) avant de supprimer.
 * La RLS `posts_delete_own` (author_id = auth.uid()) constitue une seconde
 * barrière côté base de données.
 */
export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from("posts")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Publication introuvable" }, { status: 404 })
    }
    if (existing.author_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { error } = await supabase.from("posts").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[api/posts/id DELETE]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
