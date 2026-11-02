/** Liens partage boutique / produit — parcours producteur. */

export function productShareUrl(productId: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://mygwa.org")
  return `${base.replace(/\/$/, "")}/produit/${productId}`
}

export function shopShareText(opts: {
  sellerName: string
  productCount: number
}): string {
  const name = opts.sellerName.trim() || "Producteur GWA"
  return `Découvre ma boutique sur GWA (${opts.productCount} annonce${
    opts.productCount > 1 ? "s" : ""
  }) — ${name}`
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback */
  }
  try {
    if (typeof document === "undefined") return false
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
