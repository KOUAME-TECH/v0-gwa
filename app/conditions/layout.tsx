import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description:
    "Conditions générales d’utilisation GWA — marketplace agricole, escrow, KYC et responsabilités.",
  alternates: { canonical: "https://mygwa.org/conditions" },
}

export default function ConditionsLayout({ children }: { children: React.ReactNode }) {
  return children
}
