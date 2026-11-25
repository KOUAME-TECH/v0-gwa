/**
 * Régénère les gabarits HTML statiques de `emails/` (à coller dans Supabase Auth
 * ou à prévisualiser). Usage : npx tsx scripts/render-email-templates.ts
 */
import { writeFileSync } from "node:fs"
import { renderOrderConfirmationEmail, renderPasswordResetTemplate } from "../lib/email/templates"

writeFileSync("emails/password-reset.supabase.html", renderPasswordResetTemplate() + "\n")
writeFileSync(
  "emails/order-confirmation.example.html",
  renderOrderConfirmationEmail({
    buyerName: "Awa",
    orderNumber: "GWA-2026-0001",
    productName: "Cacao grade 1",
    quantity: 50,
    unit: "kg",
    subtotal: 100000,
    buyerFee: 250,
    total: 100250,
    orderUrl: "https://mygwa.org/dashboard/commandes",
  }).html + "\n",
)
