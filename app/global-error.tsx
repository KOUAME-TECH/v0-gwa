"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Quelque chose a bloqué</h1>
          <p style={{ color: "#525252", fontSize: 14, marginBottom: 24 }}>
            L&apos;application n&apos;a pas pu s&apos;afficher. Tu peux réessayer.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: 999,
              background: "#1F5C2E",
              color: "#fff",
              padding: "12px 28px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12, color: "#a3a3a3" }}>{error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
