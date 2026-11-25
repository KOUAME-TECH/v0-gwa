import { NextResponse } from "next/server"
import { handleGeniusPayWebhook } from "@/lib/payment/geniuspay-webhook-handler"

export async function POST(request: Request) {
  const raw = await request.text()
  const result = await handleGeniusPayWebhook(raw, request.headers)
  return NextResponse.json(result.body, { status: result.status })
}
