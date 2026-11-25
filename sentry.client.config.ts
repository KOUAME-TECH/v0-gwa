import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from '@/lib/observability/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session Replay : 5 % des sessions, 100 % des sessions avec erreur
  // (annoncé dans /confidentialite).
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [
    // Valeurs par défaut du SDK, fixées ici pour qu’elles ne changent pas sans revue.
    Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
  ],
  environment: process.env.NODE_ENV,
  // Pas d’IP, cookies ni en-têtes envoyés par défaut.
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
})
