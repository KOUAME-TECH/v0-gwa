import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from '@/lib/observability/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Pas d’IP, cookies ni en-têtes envoyés par défaut.
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
})
