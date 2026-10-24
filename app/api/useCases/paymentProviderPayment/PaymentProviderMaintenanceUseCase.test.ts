import { describe, expect, it, mock } from "bun:test"
import type { PaymentProviderMaintenanceResult } from "@/app/api/services/PaymentProviderPayment/PaymentProviderMaintenanceService"
import { PaymentProviderMaintenanceUseCase } from "./PaymentProviderMaintenanceUseCase"

const clean: PaymentProviderMaintenanceResult = {
  reconciled: 1,
  stillUnknown: 0,
  skipped: 0,
  entitlementsApplied: 1,
  entitlementsAlreadyApplied: 0,
  entitlementFailures: 0,
  purchasesActivated: 0,
  purchaseActivationFailures: 0,
  ownerAttemptsReconciled: 0,
  ownerSettlementsRepaired: 0,
  ownerSettlementFailures: 0,
}

function build(result: PaymentProviderMaintenanceResult) {
  const run = mock(async (_input: unknown) => result)
  const check = mock(async () => ({ healthy: true, reasons: [] as const }))
  const useCase = new PaymentProviderMaintenanceUseCase({ run } as never, { check })
  return { useCase, run, check }
}

describe("PaymentProviderMaintenanceUseCase (PAY-HARD-T008)", () => {
  it("sem falhas devolve Output válido com o resultado", async () => {
    const { useCase } = build(clean)
    const output = await useCase.execute()
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ reconciled: 1 })
  })

  it.each([
    ["entitlementFailures"],
    ["ownerSettlementFailures"],
    ["purchaseActivationFailures"],
  ] as const)("%s > 0 devolve Output inválido para o withCronAudit acionar o Slack", async (counter) => {
    const { useCase } = build({ ...clean, [counter]: 2 })
    const output = await useCase.execute()
    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain(counter)
    expect(output.result).toMatchObject({ [counter]: 2 })
  })

  it("checa a saúde da inbox a cada execução (PAY-HARD-T007)", async () => {
    const { useCase, check } = build(clean)
    await useCase.execute()
    expect(check).toHaveBeenCalledTimes(1)
  })

  it("falha do monitor da inbox não invalida a manutenção", async () => {
    const run = mock(async () => clean)
    const useCase = new PaymentProviderMaintenanceUseCase({ run } as never, {
      check: async () => {
        throw new Error("monitor")
      },
    })
    expect((await useCase.execute()).isValid).toBe(true)
  })
})
