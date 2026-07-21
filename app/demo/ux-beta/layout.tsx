import { Fraunces, DM_Sans } from "next/font/google"

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-demo-display",
  display: "swap",
})

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-demo-body",
  display: "swap",
})

export default function DemoUxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{
        fontFamily: "var(--font-demo-body), system-ui, sans-serif",
      }}
    >
      <style>{`
        .font-serif {
          font-family: var(--font-demo-display), Georgia, serif !important;
        }
      `}</style>
      {children}
    </div>
  )
}
