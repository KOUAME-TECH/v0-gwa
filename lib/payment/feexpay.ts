/**
 * GWA — F3 Wrapper Feexpay SDK
 * Encapsule feexpay-sdk pour l'escrow GWA
 * Doc: npm feexpay-sdk v1.0.9
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Feexpay } = require("feexpay-sdk")

// ─── Types ────────────────────────────────────────────────────────────────────
export type FeexpayNetwork = "orange_money" | "mtn_money" | "moov_money" | "wave"

const NETWORK_MAP: Record<FeexpayNetwork, string> = {
  orange_money: "orange",
  mtn_money: "mtn",
  moov_money: "moov",
  wave: "wave",
}

export interface CreateTransactionParams {
  amount: number          // montant en FCFA
  phoneNumber: string     // numéro E.164 : +22507XXXXXXXX
  network: FeexpayNetwork
  motif: string           // ex: "Commande GWA-20260701-AB12CD"
  orderId: string         // référence interne GWA
  buyerEmail?: string
  buyerFirstName?: string
  buyerLastName?: string
}

export interface FeexpayTransactionResult {
  success: boolean
  feexpay_ref: string
  status: "pending" | "success" | "failed"
  message?: string
}

export interface VerifyTransactionResult {
  success: boolean
  feexpay_ref: string
  status: "pending" | "success" | "failed" | "refunded"
  amount?: number
  message?: string
}

// ─── Initialisation SDK ───────────────────────────────────────────────────────
function getFeexpayClient() {
  const apiKey = process.env.FEEXPAY_API_KEY
  const mode = process.env.FEEXPAY_MODE ?? "TEST"

  if (!apiKey) throw new Error("FEEXPAY_API_KEY manquante dans les variables d'environnement")

  return new Feexpay(apiKey, {
    mode: mode as "LIVE" | "TEST",
    timeout: 30_000,
    maxRetries: 3,
  })
}

// ─── Créer une transaction (capture paiement) ─────────────────────────────────
export async function capturePayment(
  params: CreateTransactionParams
): Promise<FeexpayTransactionResult> {
  const client = getFeexpayClient()
  const shopId = process.env.FEEXPAY_SHOP_ID
  if (!shopId) throw new Error("FEEXPAY_SHOP_ID manquant")

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/feexpay`

  try {
    const result = await client.payment.createTransaction({
      amount: params.amount,
      shop: shopId,
      callback_info: callbackUrl,
      phoneNumber: params.phoneNumber.replace(/^\+/, ""), // Feexpay sans le +
      motif: params.motif,
      network: NETWORK_MAP[params.network],
      email: params.buyerEmail,
      first_name: params.buyerFirstName,
      last_name: params.buyerLastName,
    })

    return {
      success: true,
      feexpay_ref: result?.id ?? result?.reference ?? String(result),
      status: "pending",
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[GWA] Feexpay capturePayment error:", msg)
    return { success: false, feexpay_ref: "", status: "failed", message: msg }
  }
}

// ─── Vérifier le statut d'une transaction ────────────────────────────────────
export async function verifyTransaction(
  feexpayRef: string
): Promise<VerifyTransactionResult> {
  const client = getFeexpayClient()

  try {
    const result = await client.payment.verifyTransaction(feexpayRef)
    const rawStatus = (result?.status ?? "pending").toLowerCase()

    let status: VerifyTransactionResult["status"] = "pending"
    if (rawStatus === "success" || rawStatus === "successful" || rawStatus === "completed") {
      status = "success"
    } else if (rawStatus === "failed" || rawStatus === "error") {
      status = "failed"
    } else if (rawStatus === "refunded") {
      status = "refunded"
    }

    return {
      success: true,
      feexpay_ref: feexpayRef,
      status,
      amount: result?.amount,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[GWA] Feexpay verifyTransaction error:", msg)
    return { success: false, feexpay_ref: feexpayRef, status: "failed", message: msg }
  }
}

// ─── Paiement avec polling automatique (createGlobalTransaction) ─────────────
export async function captureAndWait(
  params: CreateTransactionParams
): Promise<FeexpayTransactionResult> {
  const client = getFeexpayClient()
  const shopId = process.env.FEEXPAY_SHOP_ID
  if (!shopId) throw new Error("FEEXPAY_SHOP_ID manquant")

  try {
    const result = await client.payment.createGlobalTransaction({
      amount: params.amount,
      shop: shopId,
      callback_info: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/feexpay`,
      phoneNumber: params.phoneNumber.replace(/^\+/, ""),
      motif: params.motif,
      network: NETWORK_MAP[params.network],
      email: params.buyerEmail,
      first_name: params.buyerFirstName,
      last_name: params.buyerLastName,
    })

    const rawStatus = (result?.status ?? "").toLowerCase()
    const isSuccess = rawStatus === "success" || rawStatus === "successful" || rawStatus === "completed"

    return {
      success: isSuccess,
      feexpay_ref: result?.id ?? result?.reference ?? String(result),
      status: isSuccess ? "success" : "pending",
      message: result?.message,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, feexpay_ref: "", status: "failed", message: msg }
  }
}
