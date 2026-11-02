import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recherche",
  description: "Rechercher produits, producteurs et publications sur GWA.",
  alternates: { canonical: "https://mygwa.org/recherche" },
}

export default function RechercheLayout({ children }: { children: React.ReactNode }) {
  return children
}
