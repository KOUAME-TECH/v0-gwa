import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Boutique — produits frais",
  description:
    "Parcourir la boutique GWA : cacao, tomates, piment et produits locaux de producteurs et coopératives en Côte d’Ivoire.",
  openGraph: {
    title: "Boutique GWA",
    description: "Marketplace social africain — produits près de toi.",
    url: "https://mygwa.org/marketplace",
    siteName: "GWA",
    locale: "fr_CI",
    type: "website",
  },
  alternates: {
    canonical: "https://mygwa.org/marketplace",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children
}
