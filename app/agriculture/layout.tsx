import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Agriculture — produits du terroir",
  description:
    "Découvrir les produits agricoles GWA : cacao, café, céréales, fruits et légumes de Côte d’Ivoire.",
  openGraph: {
    title: "Agriculture | GWA",
    description: "Produits agricoles locaux — marketplace GWA.",
    url: "https://mygwa.org/agriculture",
    images: [{ url: "https://mygwa.org/icon-512.png", width: 512, height: 512, alt: "GWA" }],
  },
  alternates: { canonical: "https://mygwa.org/agriculture" },
  robots: { index: true, follow: true },
}

export default function AgricultureLayout({ children }: { children: React.ReactNode }) {
  return children
}
