import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contacter l’équipe GWA — support, partenariats et questions marketplace.",
  openGraph: {
    title: "Contact | GWA",
    description: "Écrire à GWA — WhatsApp et formulaire d’aide.",
    url: "https://mygwa.org/contact",
  },
  alternates: { canonical: "https://mygwa.org/contact" },
  robots: { index: true, follow: true },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
