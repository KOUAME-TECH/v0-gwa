/**
 * Next 16 : point d'entrée officiel de l'instrumentation navigateur.
 * Remplace sentry.client.config.ts, qui n'est plus exécuté sous Turbopack.
 * Config annoncée dans /confidentialite : Replay 5 % des sessions, 100 % des
 * sessions avec erreur, textes / champs / médias masqués, pas de PII par défaut.
 */
import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [
    // Valeurs par défaut du SDK, fixées ici pour qu'elles ne changent pas sans revue.
    Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
  ],
  environment: process.env.NODE_ENV,
  // Pas d'IP, cookies ni en-têtes envoyés par défaut.
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
})

/** Instrumente les navigations du routeur App (traces). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
