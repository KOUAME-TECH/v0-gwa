/**
 * POST /api/products/[id]/photos
 * Upload + compression WebP < 200Ko vers Supabase Storage
 * Body: FormData avec champ "photos" (max 5 fichiers)
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { compressFile, validateImageBuffer } from "@/lib/images/compress"

const MAX_FILES = 5
const MAX_INPUT_MB = 10 // taille max fichier entrant

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const supabase = await createClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    // Vérifier que le produit appartient à l'utilisateur
    const { data: product } = await supabase
      .from("products")
      .select("id, seller_id")
      .eq("id", productId)
      .single()

    if (!product || product.seller_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Parser le FormData
    const formData = await request.formData()
    const files = formData.getAll("photos") as File[]

    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} photos par offre` }, { status: 400 })
    }

    const photoUrls: string[] = []
    const compressionInfo: { name: string; originalKb: number; compressedKb: number }[] = []

    for (const file of files) {
      // Vérification taille maximale entrante
      if (file.size > MAX_INPUT_MB * 1024 * 1024) {
        return NextResponse.json(
          { error: `Fichier "${file.name}" trop volumineux (max ${MAX_INPUT_MB}Mo)` },
          { status: 400 }
        )
      }

      // Vérification type MIME
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `"${file.name}" n'est pas une image` },
          { status: 400 }
        )
      }

      // Validation buffer image
      const inputArrayBuffer = await file.arrayBuffer()
      const inputBuffer = Buffer.from(inputArrayBuffer)
      const isValid = await validateImageBuffer(inputBuffer)
      if (!isValid) {
        return NextResponse.json(
          { error: `"${file.name}" : format image non supporté` },
          { status: 400 }
        )
      }

      // Compression WebP < 200 Ko
      const { buffer: compressed, sizeKb } = await compressFile(file)
      const originalKb = Math.round(file.size / 1024)

      // Upload vers Supabase Storage (bucket "products")
      const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, compressed, {
          contentType: "image/webp",
          upsert: false,
        })

      if (uploadError) {
        console.error("[GWA] storage upload error:", uploadError.message)
        return NextResponse.json(
          { error: `Erreur upload "${file.name}" : ${uploadError.message}` },
          { status: 500 }
        )
      }

      // URL publique
      const { data: urlData } = supabase.storage
        .from("products")
        .getPublicUrl(uploadData.path)

      photoUrls.push(urlData.publicUrl)
      compressionInfo.push({ name: file.name, originalKb, compressedKb: sizeKb })
    }

    // Mettre à jour le tableau d'images du produit
    const { data: existing } = await supabase
      .from("products")
      .select("images")
      .eq("id", productId)
      .single()

    const currentImages: string[] = (existing?.images as string[]) ?? []
    const allImages = [...currentImages, ...photoUrls].slice(0, MAX_FILES)

    await supabase
      .from("products")
      .update({ images: allImages, updated_at: new Date().toISOString() })
      .eq("id", productId)

    return NextResponse.json({
      photo_urls: photoUrls,
      all_images: allImages,
      compression: compressionInfo,
    })
  } catch (err) {
    console.error("[GWA] photos route error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
