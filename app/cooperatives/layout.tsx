import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coopératives",
  description:
    "Coopératives agricoles et artisanales sur GWA — stock, membres et vente groupée.",
  alternates: { canonical: "https://mygwa.org/cooperatives" },
  robots: { index: true, follow: true },
}

export default function CooperativesLayout({ children }: { children: React.ReactNode }) {
  return children
}
