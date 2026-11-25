/**
 * Next 16 : point d'entrée officiel de l'instrumentation serveur.
 * Charge la config Sentry du runtime courant (Node ou Edge). Sans ce fichier,
 * sentry.server.config.ts et sentry.edge.config.ts ne sont jamais exécutés.
 */
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

/** Remonte les erreurs des Server Components, routes et middleware (nettoyées par beforeSend). */
export const onRequestError = Sentry.captureRequestError
