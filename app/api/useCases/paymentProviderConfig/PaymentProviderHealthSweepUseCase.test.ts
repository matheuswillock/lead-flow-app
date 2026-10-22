import { describe, expect, it } from "bun:test"
import { PaymentProviderHealthSweepUseCase } from "./PaymentProviderHealthSweepUseCase"

describe("PaymentProviderHealthSweepUseCase", () => {
  it("válido quando ninguém degradou (primeira falha não alerta)", async () => {
    const output = await new PaymentProviderHealthSweepUseCase({
      checkAll: async () => ({ checked: 2, healthy: 1, failing: 1, degraded: [] }),
    }).execute()
    expect(output.isValid).toBe(true)
  })

  it("inválido (dispara o alerta do Slack) quando uma instância degrada, sem segredo", async () => {
    const output = await new PaymentProviderHealthSweepUseCase({
      checkAll: async () => ({
        checked: 1,
        healthy: 0,
        failing: 1,
        degraded: [{ id: "i1", displayName: "Abacate", provider: "ABACATE_PAY", environment: "PRODUCTION", errorCode: "AUTHENTICATION_FAILED" }],
      }),
    }).execute()
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Abacate")
    expect(output.errorMessages[0]).toContain("AUTHENTICATION_FAILED")
  })

  it("falha do service vira Output inválido", async () => {
    const output = await new PaymentProviderHealthSweepUseCase({
      checkAll: async () => {
        throw new Error("db down")
      },
    }).execute()
    expect(output.isValid).toBe(false)
  })
})
