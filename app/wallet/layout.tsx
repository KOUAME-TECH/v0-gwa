import { redirect } from "next/navigation"
import { isWalletRegulatoryApprovalEnabled } from "@/lib/wallet/availability"
import type { ReactNode } from "react"

export const dynamic = "force-dynamic"

export default function WalletLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  if (!isWalletRegulatoryApprovalEnabled()) redirect("/")
  return children
}
