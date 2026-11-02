import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coopératives",
  description: "Découvrir et rejoindre des coopératives agricoles et artisanales sur GWA.",
  alternates: { canonical: "https://mygwa.org/cooperatives" },
}

export default function CooperativesLayout({ children }: { children: React.ReactNode }) {
  return children
}
