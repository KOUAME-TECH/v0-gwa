import { redirect } from "next/navigation"

/**
 * Ancien formulaire produit — redirige vers le parcours unifié `/publier`
 * (images + vidéo + audio + file hors-ligne).
 */
export default function NewProductRedirectPage() {
  redirect("/publier")
}
