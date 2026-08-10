/**
 * Inventaire des routes GWA — statut d'implémentation.
 * complete = backend + UI branchés | partial = UI OK, backend incomplet | redirect | missing_api
 */

export type RouteStatus = "complete" | "partial" | "redirect" | "missing"

export interface RouteEntry {
  path: string
  status: RouteStatus
  note?: string
}

/** Pages App Router */
export const PAGE_ROUTES: RouteEntry[] = [
  { path: "/", status: "complete", note: "Accueil / feed" },
  { path: "/agriculture", status: "complete" },
  { path: "/agriculture/produit/[id]", status: "redirect", note: "next.config → /produit/[id]" },
  { path: "/marketplace", status: "complete", note: "Lit products via Supabase /api/products" },
  { path: "/marketplace/product/[id]", status: "redirect", note: "next.config → /produit/[id]" },
  { path: "/produit/[id]", status: "complete" },
  { path: "/post/[id]", status: "complete", note: "Commentaires texte+voix via /api/comments" },
  { path: "/produit/[id]/edit", status: "complete", note: "UI + /api/products/[id]" },
  { path: "/publier", status: "complete", note: "POST /api/products" },
  { path: "/panier", status: "partial", note: "Checkout client ; pay via /api/orders/[id]/pay" },
  { path: "/favoris", status: "complete" },
  { path: "/recherche", status: "complete" },
  { path: "/commandes/confirmation", status: "partial", note: "UI ; escrow via /api/orders/*/pay" },
  { path: "/messages", status: "complete", note: "Realtime + push OneSignal /api/messages/notify" },
  { path: "/notifications", status: "complete", note: "UI + push Activer/Tester OneSignal" },
  { path: "/profil", status: "complete" },
  { path: "/profil/[id]", status: "complete" },
  { path: "/profil/edit", status: "complete" },
  { path: "/profile", status: "redirect", note: "next.config → /profil" },
  { path: "/scg", status: "complete", note: "Moteur lib/scg + /api/scg/calculate branché" },
  { path: "/wallet", status: "complete", note: "Transactions + lien affacturage" },
  { path: "/abonnement", status: "complete", note: "Abo vendeur Free/Starter 7.5k/Pro 18k ; WhatsApp + activation admin" },
  { path: "/affacturage", status: "complete", note: "F3 demande + statut ; /api/factoring" },
  { path: "/facture/[id]", status: "complete", note: "Facture numérique imprimable ; /api/invoices/[id]" },
  { path: "/download", status: "complete", note: "PWA install" },
  { path: "/contact", status: "complete", note: "POST /api/contact via AgentMail ; WhatsApp + liens légaux" },
  { path: "/conditions", status: "complete", note: "CGU FR (bêta, revue juridique)" },
  { path: "/confidentialite", status: "complete", note: "Politique de confidentialité FR (RGPD + CI)" },
  { path: "/communaute", status: "redirect", note: "Hors scope social → /messages (page supprimée)" },
  { path: "/cooperatives", status: "complete" },
  { path: "/cooperatives/create", status: "partial" },
  { path: "/b2b", status: "redirect", note: "Hors scope → /marketplace" },
  { path: "/business", status: "redirect", note: "Hors scope → /agriculture" },
  { path: "/formations", status: "redirect", note: "Hors scope F1–F6 → /" },
  { path: "/formations/[id]", status: "redirect", note: "Hors scope → /" },
  { path: "/learning", status: "redirect", note: "Hors scope → /" },
  { path: "/artisans", status: "redirect", note: "next.config → /agriculture" },
  { path: "/artisans/commissions", status: "redirect", note: "next.config → /agriculture" },
  { path: "/network", status: "redirect", note: "Hors scope LinkedIn → /messages" },
  { path: "/network/profile/[id]", status: "redirect", note: "→ /profil/[id]" },
  { path: "/auth/login", status: "complete", note: "OTP + email ; SMS dépend provider" },
  { path: "/auth/signup", status: "complete" },
  { path: "/auth/onboarding", status: "complete" },
  { path: "/auth/callback", status: "complete" },
  { path: "/auth/error", status: "complete" },
  { path: "/auth/sign-up-success", status: "complete" },
  { path: "/dashboard", status: "complete" },
  { path: "/dashboard/farmer", status: "complete" },
  { path: "/dashboard/buyer", status: "complete" },
  { path: "/dashboard/business", status: "redirect", note: "Hors scope → /dashboard/farmer (page supprimée)" },
  { path: "/dashboard/cooperative", status: "partial" },
  { path: "/dashboard/student", status: "redirect", note: "Hors scope → /dashboard (page supprimée)" },
  { path: "/dashboard/artisan", status: "redirect", note: "next.config → /dashboard/farmer" },
  { path: "/dashboard/products", status: "complete" },
  { path: "/dashboard/products/new", status: "complete", note: "Via /api/products" },
  { path: "/dashboard/products/[id]/edit", status: "complete", note: "Via /api/products/[id]" },
  { path: "/dashboard/commandes", status: "complete", note: "Confirm/litige UI + escrow stepper" },
  { path: "/dashboard/reviews", status: "partial" },
  { path: "/admin", status: "complete" },
  { path: "/admin/users", status: "complete" },
  { path: "/admin/products", status: "complete" },
  { path: "/admin/orders", status: "complete", note: "Escrow stepper + filtre litiges" },
  { path: "/admin/disputes", status: "complete", note: "Resolve → escrow release/refund" },
  { path: "/admin/finances", status: "partial", note: "File affacturage → /admin/factoring" },
  { path: "/admin/factoring", status: "complete", note: "F3/F5 file affacturage semi-manuel + snapshot SCG" },
  { path: "/admin/cooperatives", status: "complete", note: "Liste coopératives (lecture)" },
  { path: "/admin/analytics", status: "complete", note: "Escrow held + litiges ouverts" },
  { path: "/admin/reports", status: "partial" },
  { path: "/admin/scg", status: "complete" },
  { path: "/admin/settings", status: "partial" },
  { path: "/admin/verifications", status: "complete", note: "KYC via /api/admin/verifications/[id] (service role)" },
]

/** API routes présentes */
export const API_ROUTES: RouteEntry[] = [
  { path: "/api/health", status: "complete" },
  { path: "/api/weather", status: "complete", note: "Open-Meteo réel" },
  { path: "/api/contact", status: "complete", note: "AgentMail" },
  { path: "/api/auth/send-otp", status: "complete" },
  { path: "/api/auth/verify-otp", status: "complete", note: "Calcule SCG après login" },
  { path: "/api/auth/me", status: "complete" },
  { path: "/api/auth/logout", status: "complete" },
  { path: "/api/auth/link-email", status: "complete" },
  { path: "/api/scg/calculate", status: "complete" },
  { path: "/api/scg/[profileId]", status: "complete" },
  { path: "/api/profiles/[id]", status: "complete" },
  { path: "/api/onesignal/register", status: "complete" },
  { path: "/api/products", status: "complete", note: "CRUD F2" },
  { path: "/api/products/[id]", status: "complete" },
  { path: "/api/products/[id]/like", status: "complete", note: "Toggle j'aime produit (séparé des favoris)" },
  { path: "/api/orders", status: "complete", note: "F3 + escrow pending" },
  { path: "/api/orders/[id]/pay", status: "partial", note: "Live Feexpay ; simu hors prod uniquement" },
  { path: "/api/orders/[id]/confirm", status: "complete" },
  { path: "/api/orders/[id]/litige", status: "complete" },
  { path: "/api/seller/stats", status: "complete", note: "Starter+ entitlements" },
  { path: "/api/wallet/withdraw", status: "complete", note: "Retrait FeexPay / file ops" },
  { path: "/api/orders/[id]/pay", status: "complete", note: "FeexPay requesttopay + payment_url" },
  { path: "/api/orders/[id]/confirm", status: "complete", note: "Payout vendeur + release escrow" },
  { path: "/abonnement", status: "complete", note: "Plans = entitlements rendus" },
  { path: "/api/notifications", status: "complete" },
  { path: "/api/messages/notify", status: "complete", note: "OneSignal push" },
  { path: "/api/admin/users/[id]", status: "complete", note: "PATCH verify/suspend service role" },
  { path: "/api/admin/users", status: "complete", note: "GET liste + rôles admin service role (post-035)" },
  { path: "/api/admin/scg", status: "complete", note: "GET SCG v1 dimensions + seuils ; v2 FastAPI post-bêta" },
  { path: "/api/factoring", status: "complete", note: "F3/F5 affacturage POST/GET + snapshot SCG + gate rôle" },
  { path: "/api/admin/factoring/[id]", status: "complete", note: "PATCH approve/reject/disburse service role" },
  { path: "/api/invoices/[id]", status: "complete", note: "F3 facture numérique JSON" },
  { path: "/api/admin/verifications/[id]", status: "complete", note: "KYC approve/reject service role" },
  { path: "/api/admin/export", status: "complete", note: "F6 export CSV users|orders|products|factoring" },
]

/** APIs volontairement absentes / externes */
export const MISSING_APIS: RouteEntry[] = [
  { path: "/api/prices", status: "missing", note: "OCPV supprimé volontairement" },
]

export function getIncompletePages(): RouteEntry[] {
  return PAGE_ROUTES.filter((r) => r.status === "partial" || r.status === "missing")
}

export function getRouteStatus(pathname: string): RouteEntry | undefined {
  const exact = PAGE_ROUTES.find((r) => r.path === pathname)
  if (exact) return exact
  return PAGE_ROUTES.find((r) => {
    const pattern = "^" + r.path.replace(/\[.*?\]/g, "[^/]+") + "$"
    return new RegExp(pattern).test(pathname)
  })
}
