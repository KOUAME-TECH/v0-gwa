import { describe, it, expect } from "vitest"
import {
  resolveEscrowStep,
  normalizeOrderStatus,
  orderFlowIndex,
} from "@/lib/orders/escrow-flow"
import { getCoachActions, buildCoachSpeech } from "@/lib/scg/coach"

describe("escrow-flow", () => {
  it("normalize aliases UI → DB", () => {
    expect(normalizeOrderStatus("preparing")).toBe("processing")
    expect(normalizeOrderStatus("shipping")).toBe("shipped")
  })

  it("step paid+held → séquestre", () => {
    expect(resolveEscrowStep({ payment_status: "paid", escrow_status: "held", status: "confirmed" })).toBe(1)
  })

  it("step shipped → livré", () => {
    expect(resolveEscrowStep({ payment_status: "paid", escrow_status: "held", status: "shipped" })).toBe(2)
  })

  it("step released → libéré", () => {
    expect(resolveEscrowStep({ payment_status: "paid", escrow_status: "released", status: "delivered" })).toBe(4)
  })

  it("orderFlowIndex", () => {
    expect(orderFlowIndex("processing")).toBe(2)
  })
})

describe("scg coach", () => {
  it("retourne 2 actions sur dims faibles", () => {
    const actions = getCoachActions({
      fiabilite: 20,
      qualite: 80,
      engagement: 15,
      volumes: 70,
      stabilite: 60,
    })
    expect(actions).toHaveLength(2)
    expect(actions[0].dim).toBe("engagement")
    expect(actions[1].dim).toBe("fiabilite")
    expect(buildCoachSpeech(420, actions)).toMatch(/420/)
  })
})
