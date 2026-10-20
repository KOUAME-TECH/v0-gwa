import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Le webhook FeexPay est désactivé." },
    { status: 410 },
  )
}
