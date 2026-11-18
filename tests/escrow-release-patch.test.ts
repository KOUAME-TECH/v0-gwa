import { describe, expect, it } from "vitest"
import { releaseEscrowWithLedger } from "@/lib/orders/escrow-release"

type Call = { fn: string; args: Record<string, unknown> }
const client = (reply: { data?: unknown; error: { message: string } | null }) => {
  const calls: Call[] = []
  return { calls, rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), reply) }
}
// 1250 = 930 net vendeur + 70 commission + 250 frais acheteur + 0 frais de versement (figé)
const order = {
  id: "00000000-0000-4000-8000-000000000065", payment_status: "paid", escrow_status: "held",
  total_amount: 1250, vendeur_recoit_fcfa: 930, commission_fcfa: 70, buyer_service_fee: 250,
  payout_fee_frozen_fcfa: 0, currency: "XOF",
}

describe("releaseEscrowWithLedger", () => {
  it("passe par la RPC unique gwa_post_release_split avec la ventilation complète", async () => {
    const c = client({ data: { ok: true, skipped: false }, error: null })
    expect(await releaseEscrowWithLedger(c as never, order)).toEqual({ ok: true, skipped: false })
    expect(c.calls).toHaveLength(1)
    expect(c.calls[0].fn).toBe("gwa_post_release_split")
    expect(c.calls[0].args).toMatchObject({
      p_seller_net: 930, p_commission: 70, p_buyer_fee: 250, p_payout_fee: 0,
      p_action: "release", p_next_escrow: "released", p_next_status: "delivered",
    })
  })
  it("échec de la RPC → échec de la libération (aucun autre appel)", async () => {
    const c = client({ data: null, error: { message: "split_mismatch" } })
    const r = await releaseEscrowWithLedger(c as never, order)
    expect(r.ok).toBe(false)
    expect(c.calls).toHaveLength(1)
  })
  it("refuse sans RPC si le séquestre n'est pas held (hors litige)", async () => {
    const c = client({ data: { ok: true }, error: null })
    expect((await releaseEscrowWithLedger(c as never, { ...order, escrow_status: "released" })).ok).toBe(false)
    expect(c.calls).toHaveLength(0)
  })
  it("litige : action dispute_release, la RPC vérifie frozen/disputed sous verrou", async () => {
    const c = client({ data: { ok: true, skipped: false }, error: null })
    expect((await releaseEscrowWithLedger(c as never, { ...order, escrow_status: "frozen" }, { fromDispute: true })).ok).toBe(true)
    expect(c.calls[0].args.p_action).toBe("dispute_release")
  })
  it("ventilation ≠ brut → refus sans appel", async () => {
    const c = client({ data: { ok: true }, error: null })
    expect((await releaseEscrowWithLedger(c as never, { ...order, buyer_service_fee: 200 })).ok).toBe(false)
    expect(c.calls).toHaveLength(0)
  })
})
