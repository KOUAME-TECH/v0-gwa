import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Politique de confidentialité GWA — données personnelles, cookies, stockage chat et paiements séquestre.",
  alternates: { canonical: "https://mygwa.org/confidentialite" },
}

export default function ConfidentialiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
