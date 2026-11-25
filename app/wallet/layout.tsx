import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { isWalletEnabled } from "@/lib/feature-flags/server"
import { WALLET_DISABLED_REDIRECT } from "@/lib/feature-flags/core"

export const dynamic = "force-dynamic"

/**
 * Wallet masqué tant que le drapeau `wallet` n'est pas actif (agrément BCEAO).
 * Double garde avec le proxy : fail-closed si la table ou la ligne manque.
 */
export default async function WalletLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  if (!(await isWalletEnabled())) {
    redirect(WALLET_DISABLED_REDIRECT)
  }
  return children
}
