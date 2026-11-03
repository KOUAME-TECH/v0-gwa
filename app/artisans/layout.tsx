import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Artisans",
  description:
    "Artisanat africain sur GWA — créer, vendre et découvrir des pièces locales.",
  alternates: { canonical: "https://mygwa.org/artisans" },
  robots: { index: true, follow: true },
}

export default function ArtisansLayout({ children }: { children: React.ReactNode }) {
  return children
}
