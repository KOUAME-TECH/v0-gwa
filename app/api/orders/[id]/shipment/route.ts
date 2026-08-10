/**
 * POST /api/orders/[id]/shipment — Preuve d'expédition (vendeur)
 * FormData avec champ "proof" (image)
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { compressFile } from "@/lib/images/compress"
import { sendPushNotification } from "@/lib/notifications/push"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    // Seul le vendeur peut uploader la preuve d'expédition
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("seller_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (!["confirme", "en_preparation", "paiement_escrow"].includes(order.status)) {
      return NextResponse.json(
        { error: "Statut de commande incompatible pour l'expédition" },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const proof = formData.get("proof") as File | null
    if (!proof) {
      return NextResponse.json({ error: "Fichier 'proof' manquant" }, { status: 400 })
    }

    if (!proof.type.startsWith("image/")) {
      return NextResponse.json({ error: "Le fichier doit être une image" }, { status: 400 })
    }

    // Compresser l'image
    const { buffer } = await compressFile(proof)

    // Uploader dans Supabase Storage bucket "orders"
    const fileName = `${orderId}/shipment_${Date.now()}.webp`
    const { error: uploadError } = await supabase.storage
      .from("orders")
      .upload(fileName, buffer, {
        contentType: "image/webp",
        upsert: true,
      })

    if (uploadError) {
      console.error("[GWA] shipment upload error:", uploadError)
      return NextResponse.json({ error: "Erreur upload image" }, { status: 500 })
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage.from("orders").getPublicUrl(fileName)
    const proof_url = urlData.publicUrl

    const now = new Date().toISOString()

    // Mettre à jour la commande
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        proof_of_shipment_url: proof_url,
        status: "en_transit",
        updated_at: now,
      })
      .eq("id", orderId)

    if (updateError) {
      console.error("[GWA] shipment order update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Notifier l'acheteur
    await sendPushNotification(order.buyer_id, {
      title: "Votre commande est en route ! 🚚",
      body: `La commande ${order.order_number} a été expédiée. Preuve disponible dans l'application.`,
      data: { type: "order_status", order_id: orderId },
    }).catch(() => null)

    return NextResponse.json({
      success: true,
      proof_of_shipment_url: proof_url,
    })
  } catch (err) {
    console.error("[GWA] POST /api/orders/[id]/shipment exception:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
