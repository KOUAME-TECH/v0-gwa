import { describe, it, expect } from "vitest"
import {
  resolveEscrowStep,
  normalizeOrderStatus,
  orderFlowIndex,
  mapLitigeDescriptionToReason,
  canBuyerConfirmReception,
  canOpenLitige,
} from "@/lib/orders/escrow-flow"
import { getCoachActions, buildCoachSpeech, coachBand } from "@/lib/scg/coach"

describe("escrow-flow", () => {
  it("normalize aliases UI → DB", () => {
    expect(normalizeOrderStatus("preparing")).toBe("processing")
    expect(normalizeOrderStatus("shipping")).toBe("shipped")
  })

  it("step paid+held → séquestre", () => {
    expect(
      resolveEscrowStep({
        payment_status: "paid",
        escrow_status: "held",
        status: "confirmed",
      }),
    ).toBe(1)
  })

  it("step shipped → livré", () => {
    expect(
      resolveEscrowStep({
        payment_status: "paid",
        escrow_status: "held",
        status: "shipped",
      }),
    ).toBe(2)
  })

  it("step delivered+held → confirmé (3)", () => {
    expect(
      resolveEscrowStep({
        payment_status: "paid",
        escrow_status: "held",
        status: "delivered",
      }),
    ).toBe(3)
  })

  it("step released → libéré", () => {
    expect(
      resolveEscrowStep({
        payment_status: "paid",
        escrow_status: "released",
        status: "delivered",
      }),
    ).toBe(4)
  })

  it("orderFlowIndex", () => {
    expect(orderFlowIndex("processing")).toBe(2)
  })

  it("map litige reasons alignés CHECK", () => {
    expect(mapLitigeDescriptionToReason("pas reçu")).toBe("product_not_received")
    expect(mapLitigeDescriptionToReason("produit abîmé")).toBe("product_damaged")
    expect(mapLitigeDescriptionToReason("mauvais produit")).toBe("wrong_product")
    expect(mapLitigeDescriptionToReason("qualité médiocre")).toBe("quality_issue")
    expect(mapLitigeDescriptionToReason("autre truc")).toBe("other")
  })

  it("canBuyerConfirmReception exige shipped + held", () => {
    expect(
      canBuyerConfirmReception({
        isSeller: false,
        payment_status: "paid",
        escrow_status: "held",
        status: "processing",
      }),
    ).toBe(false)
    expect(
      canBuyerConfirmReception({
        isSeller: false,
        payment_status: "paid",
        escrow_status: "pending",
        status: "shipped",
      }),
    ).toBe(false)
    expect(
      canBuyerConfirmReception({
        isSeller: false,
        payment_status: "paid",
        escrow_status: "held",
        status: "shipped",
      }),
    ).toBe(true)
  })

  it("canOpenLitige autorise held même si delivered", () => {
    expect(
      canOpenLitige({
        payment_status: "paid",
        escrow_status: "held",
        status: "delivered",
      }),
    ).toBe(true)
    expect(
      canOpenLitige({
        payment_status: "paid",
        escrow_status: "held",
        status: "shipped",
      }),
    ).toBe(true)
    expect(
      canOpenLitige({
        payment_status: "paid",
        escrow_status: "frozen",
        status: "disputed",
      }),
    ).toBe(false)
  })
})

describe("scg coach", () => {
  it("retourne 3 actions sur dims faibles", () => {
    const actions = getCoachActions({
      fiabilite: 20,
      qualite: 80,
      engagement: 15,
      volumes: 70,
      stabilite: 10,
    })
    expect(actions).toHaveLength(3)
    expect(actions[0].dim).toBe("stabilite")
    expect(actions[1].dim).toBe("engagement")
    expect(actions[2].dim).toBe("fiabilite")
    expect(buildCoachSpeech(420, actions)).toMatch(/420/)
    expect(coachBand(420)).toBe("mid")
  })
})
