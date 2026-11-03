import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Télécharger l’app",
  description:
    "Installer GWA sur Android, iOS ou bureau — marketplace agricole ivoirienne, mode hors-ligne et notifications.",
  alternates: { canonical: "https://mygwa.org/download" },
  openGraph: {
    title: "Télécharger GWA",
    description: "Application web installable — marché agricole Côte d’Ivoire.",
    url: "https://mygwa.org/download",
  },
}

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children
}
