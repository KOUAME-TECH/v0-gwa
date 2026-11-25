import { NextResponse } from "next/server"
import { WALLET_FLAG, fetchFeatureFlag } from "@/lib/feature-flags/core"

/** Lecture serveur d'un drapeau (fail-closed, cache 30 s). */
export async function getFeatureFlag(key: string): Promise<boolean> {
  return fetchFeatureFlag(key)
}

export async function isWalletEnabled(): Promise<boolean> {
  return getFeatureFlag(WALLET_FLAG)
}

/** Réponse des API wallet quand le drapeau est off : la ressource n'existe pas. */
export function walletDisabledResponse() {
  return NextResponse.json(
    { error: "Fonctionnalité indisponible", code: "FEATURE_DISABLED" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  )
}
