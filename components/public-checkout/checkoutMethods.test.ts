import { describe, expect, it } from "bun:test"

import { pickBillingType, resolveCheckoutMethods } from "./checkoutMethods"

describe("resolveCheckoutMethods", () => {
  it("usa PIX por padrão (falha fechada)", () => {
    expect(resolveCheckoutMethods({})).toEqual(["PIX"])
    expect(resolveCheckoutMethods({ availableMethods: [] })).toEqual(["PIX"])
  })

  it("pixOnly legado sempre vence", () => {
    expect(resolveCheckoutMethods({ pixOnly: true, availableMethods: ["PIX", "CREDIT_CARD"] })).toEqual(["PIX"])
  })

  it("expõe o cartão só quando declarado", () => {
    expect(resolveCheckoutMethods({ availableMethods: ["PIX", "CREDIT_CARD"] })).toEqual(["PIX", "CREDIT_CARD"])
  })
})

describe("pickBillingType", () => {
  it("nunca devolve cartão indisponível", () => {
    expect(pickBillingType("CREDIT_CARD", ["PIX"])).toBe("PIX")
    expect(pickBillingType(undefined, ["PIX"])).toBe("PIX")
  })

  it("respeita o preset quando disponível", () => {
    expect(pickBillingType("CREDIT_CARD", ["PIX", "CREDIT_CARD"])).toBe("CREDIT_CARD")
    expect(pickBillingType("PIX", ["PIX", "CREDIT_CARD"])).toBe("PIX")
  })

  it("cai para o primeiro método disponível", () => {
    expect(pickBillingType("PIX", ["CREDIT_CARD"])).toBe("CREDIT_CARD")
  })
})
