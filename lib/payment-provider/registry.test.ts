import { describe, expect, it } from "bun:test"
import { PaymentProviderRegistry } from "./registry"

describe("payment provider registry", () => {
  it("deriva capabilities exclusivamente do metadata dos adapters", () => {
    const registry = new PaymentProviderRegistry([
      {
        metadata: {
          key: "ABACATE_PAY",
          environment: "PRODUCTION",
          capabilities: ["PIX", "CARD"],
        },
      },
    ])

    expect(registry.list("PRODUCTION")).toEqual([
      {
        key: "ABACATE_PAY",
        environment: "PRODUCTION",
        capabilities: ["PIX", "CARD"],
      },
    ])
  })

  it("rejeita dois adapters para o mesmo provider e ambiente", () => {
    expect(
      () =>
        new PaymentProviderRegistry([
          { metadata: { key: "ASAAS", environment: "DEV", capabilities: [] } },
          { metadata: { key: "ASAAS", environment: "DEV", capabilities: [] } },
        ]),
    ).toThrow("duplicado")
  })
})
