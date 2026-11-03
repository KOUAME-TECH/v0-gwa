import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aide",
  description: "Centre d’aide GWA — FAQ, contact et guides pour producteurs et acheteurs.",
  alternates: { canonical: "https://mygwa.org/aide" },
}

export default function AideLayout({ children }: { children: React.ReactNode }) {
  return children
}
