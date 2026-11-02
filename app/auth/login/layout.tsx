import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à GWA par téléphone, e-mail ou Google pour acheter, vendre et discuter.",
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
