import { createHmac, timingSafeEqual } from "crypto"

const REPLAY_WINDOW_SECONDS = 300

export function isGeniusPayWebhookTimestampFresh(
  timestamp: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!/^\d{1,12}$/.test(timestamp)) return false
  const sentAt = Number(timestamp)
  return Number.isSafeInteger(sentAt) && Math.abs(nowSeconds - sentAt) <= REPLAY_WINDOW_SECONDS
}

export function verifyGeniusPayWebhookSignature(input: {
  timestamp: string
  rawBody: string | Uint8Array
  signature: string
  secret: string
}): boolean {
  if (!input.secret || !/^[a-f0-9]{64}$/i.test(input.signature)) return false
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.`, "utf8")
    .update(input.rawBody)
    .digest()
  const received = Buffer.from(input.signature, "hex")
  return received.length === expected.length && timingSafeEqual(received, expected)
}
