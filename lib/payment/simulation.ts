export function isPaymentSimulationAllowed(
  env: Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL_ENV" | "ALLOW_PAYMENT_SIMULATION"> =
    process.env,
): boolean {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") return false
  if (env.ALLOW_PAYMENT_SIMULATION === "true") return true
  return env.NODE_ENV === "development" && !env.VERCEL_ENV
}
