/**
 * Gabarits e-mail GWA (HTML compatible clients mail : tableaux, styles en ligne,
 * largeur 600 px, texte alternatif). Aucun envoi ici : rendu pur et testable.
 *
 * Fournisseurs (état au 25/11/2026) :
 * - Réinitialisation / confirmation de compte : Supabase Auth (gabarits à coller
 *   dans Auth → Email Templates, voir `emails/*.html`).
 * - Confirmation de commande : aujourd'hui notification in-app + push OneSignal ;
 *   ce gabarit est prêt pour un envoi SMTP (Zoho, domaine mygwa.org) après go de Yao.
 */

export const GWA_EMAIL_BRAND = {
  name: "GWA",
  site: "https://mygwa.org",
  logo: "https://mygwa.org/icon-192.png",
  primary: "#1F5C2E",
  commerce: "#2F7D32",
  gold: "#C27D10",
  cream: "#FFF6E5",
  text: "#111827",
  muted: "#4B5563",
  support: "contact@mygwa.org",
} as const

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** N'accepte que des liens https vers mygwa.org (ou ses sous-domaines). */
export function safeGwaUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === "https:" && (u.hostname === "mygwa.org" || u.hostname.endsWith(".mygwa.org"))) {
      return u.toString()
    }
  } catch {
    /* lien invalide */
  }
  return GWA_EMAIL_BRAND.site
}

export function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\u202f|\u00a0/g, " ")} FCFA`
}

export function gwaEmailLayout(opts: {
  preheader: string
  title: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  footerNote?: string
}): string {
  const b = GWA_EMAIL_BRAND
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${b.cream};font-family:Arial,Helvetica,sans-serif;color:${b.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.cream};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:${b.primary};padding:20px 24px;">
<a href="${b.site}" style="text-decoration:none;color:#ffffff;">
<img src="${b.logo}" width="40" height="40" alt="GWA" style="vertical-align:middle;border-radius:8px;border:0;">
<span style="font-size:20px;font-weight:bold;vertical-align:middle;margin-left:10px;color:#ffffff;">GWA</span>
</a>
</td></tr>
<tr><td style="padding:28px 24px 8px 24px;">
<h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:${b.text};">${escapeHtml(opts.title)}</h1>
<div style="font-size:16px;line-height:1.6;color:${b.text};">${opts.bodyHtml}</div>
</td></tr>
<tr><td style="padding:8px 24px 28px 24px;">
<a href="${opts.ctaUrl}" style="display:inline-block;background:${b.commerce};color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 24px;border-radius:999px;">${escapeHtml(opts.ctaLabel)}</a>
<p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:${b.muted};">Si le bouton ne marche pas, copiez ce lien :<br><a href="${opts.ctaUrl}" style="color:${b.primary};word-break:break-all;">${opts.ctaUrl}</a></p>
</td></tr>
<tr><td style="background:#F9FAFB;padding:16px 24px;font-size:12px;line-height:1.5;color:${b.muted};">
${opts.footerNote ? `${escapeHtml(opts.footerNote)}<br>` : ""}GWA · Agriculture &amp; Finance · Abidjan, Côte d'Ivoire · <a href="mailto:${b.support}" style="color:${b.primary};">${b.support}</a><br>
<a href="${b.site}/confidentialite" style="color:${b.muted};">Confidentialité</a> · <a href="${b.site}/conditions" style="color:${b.muted};">Conditions</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export type OrderConfirmationEmail = {
  buyerName: string
  orderNumber: string
  productName: string
  quantity: number
  unit?: string | null
  subtotal: number
  buyerFee: number
  total: number
  orderUrl: string
}

/** Confirmation de commande (paiement reçu, fonds en séquestre). */
export function renderOrderConfirmationEmail(o: OrderConfirmationEmail): {
  subject: string
  html: string
  text: string
} {
  const url = safeGwaUrl(o.orderUrl)
  const qty = `${o.quantity}${o.unit ? ` ${o.unit}` : ""}`
  const row = (k: string, v: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:${GWA_EMAIL_BRAND.muted};">${escapeHtml(k)}</td><td align="right" style="padding:6px 0;${bold ? "font-weight:bold;" : ""}">${escapeHtml(v)}</td></tr>`
  const bodyHtml = `<p style="margin:0 0 12px 0;">Bonjour ${escapeHtml(o.buyerName)},</p>
<p style="margin:0 0 16px 0;">Votre paiement est reçu. L'argent est gardé par GWA (séquestre) et sera versé au vendeur après votre confirmation de livraison.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;margin:0 0 16px 0;">
${row("Commande", o.orderNumber)}
${row("Produit", o.productName)}
${row("Quantité", qty)}
${row("Sous-total", formatFcfa(o.subtotal))}
${row("Frais de service", formatFcfa(o.buyerFee))}
${row("Total payé", formatFcfa(o.total), true)}
</table>`
  const subject = `Commande ${o.orderNumber} confirmée`
  return {
    subject,
    html: gwaEmailLayout({
      preheader: `Paiement reçu : ${formatFcfa(o.total)}. Fonds gardés jusqu'à la livraison.`,
      title: "Commande confirmée",
      bodyHtml,
      ctaLabel: "Suivre ma commande",
      ctaUrl: url,
      footerNote: "Vous recevez cet e-mail parce que vous avez passé une commande sur GWA.",
    }),
    text: [
      `Bonjour ${o.buyerName},`,
      "Votre paiement est reçu. L'argent est gardé par GWA jusqu'à votre confirmation de livraison.",
      `Commande : ${o.orderNumber}`,
      `Produit : ${o.productName} (${qty})`,
      `Total payé : ${formatFcfa(o.total)} (dont frais ${formatFcfa(o.buyerFee)})`,
      `Suivre ma commande : ${url}`,
      `Aide : ${GWA_EMAIL_BRAND.support}`,
    ].join("\n"),
  }
}

/**
 * Réinitialisation du mot de passe : version Supabase Auth.
 * `{{ .ConfirmationURL }}` est remplacé par Supabase (ne pas échapper).
 */
export function renderPasswordResetTemplate(confirmationUrlToken = "{{ .ConfirmationURL }}"): string {
  return gwaEmailLayout({
    preheader: "Lien à usage unique et limité dans le temps. Ignorez cet e-mail si vous n'avez rien demandé.",
    title: "Réinitialiser votre mot de passe",
    bodyHtml: `<p style="margin:0 0 12px 0;">Bonjour,</p>
<p style="margin:0 0 12px 0;">Vous avez demandé à changer votre mot de passe GWA. Cliquez sur le bouton ci-dessous. Le lien ne sert qu’une fois et expire rapidement.</p>
<p style="margin:0;">Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.</p>`,
    ctaLabel: "Choisir un nouveau mot de passe",
    ctaUrl: confirmationUrlToken,
    footerNote: "GWA ne vous demandera jamais votre mot de passe ni un code par téléphone.",
  })
}
