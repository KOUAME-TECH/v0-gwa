import { type NextRequest, NextResponse } from "next/server"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Like produit désactivé — les produits utilisent uniquement les favoris (Bookmark).
 * Les j’aime restent réservés aux publications (posts).
 */
export async function POST(_request: NextRequest, _context: Ctx) {
  return NextResponse.json(
    {
      error: "Les likes produit sont désactivés. Utilise les favoris.",
      code: "PRODUCT_LIKES_DISABLED",
    },
    { status: 410 },
  )
}

export async function GET(_request: NextRequest, _context: Ctx) {
  return NextResponse.json(
    {
      error: "Les likes produit sont désactivés. Utilise les favoris.",
      code: "PRODUCT_LIKES_DISABLED",
      liked: false,
      likes_count: 0,
    },
    { status: 410 },
  )
}
