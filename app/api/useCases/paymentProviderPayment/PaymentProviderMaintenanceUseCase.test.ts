import { describe, expect, it, mock } from "bun:test"
import type { PaymentProviderMaintenanceResult } from "@/app/api/services/PaymentProviderPayment/PaymentProviderMaintenanceService"
import { PaymentProviderMaintenanceUseCase } from "./PaymentProviderMaintenanceUseCase"

const CLEAN_RESULT: PaymentProviderMaintenanceResult = {
  reconciled: 2,
  stillUnknown: 1,
  skipped: 0,
  entitlementsApplied: 1,
  entitlementsAlreadyApplied: 0,
  entitlementFailures: 0,
  purchasesActivated: 1,
  purchaseActivationFailures: 0,
  ownerAttemptsReconciled: 0,
  ownerSettlementsRepaired: 0,
  ownerSettlementFailures: 0,
}

function buildUseCase(result: PaymentProviderMaintenanceResult) {
  const run = mock(async (_input: { limit?: number }) => result)
  return { useCase: new PaymentProviderMaintenanceUseCase({ run }), run }
}

describe("PaymentProviderMaintenanceUseCase", () => {
  it("com todos os contadores de falha zerados devolve Output válido com o resultado", async () => {
    const { useCase, run } = buildUseCase(CLEAN_RESULT)

    const output = await useCase.execute({ limit: 10 })

    expect(output.isValid).toBe(true)
    expect(output.errorMessages).toEqual([])
    expect(output.result).toEqual(CLEAN_RESULT)
    expect(run).toHaveBeenCalledWith({ limit: 10 })
  })

  it.each([
    ["entitlementFailures", "entitlementFailures=2"],
    ["purchaseActivationFailures", "purchaseActivationFailures=1"],
    ["ownerSettlementFailures", "ownerSettlementFailures=3"],
  ] as const)("falha parcial em %s torna o Output inválido para disparar o alerta do cron", async (counter, expected) => {
    const count = Number(expected.split("=")[1])
    const { useCase } = buildUseCase({ ...CLEAN_RESULT, [counter]: count })

    const output = await useCase.execute()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain(expected)
    expect(output.result).toMatchObject({ [counter]: count })
  })

  it("lista todos os contadores com falha na mensagem, sem dados sensíveis", async () => {
    const { useCase } = buildUseCase({
      ...CLEAN_RESULT,
      entitlementFailures: 1,
      ownerSettlementFailures: 4,
    })

    const output = await useCase.execute()
    const message = output.errorMessages.join(" ")

    expect(output.isValid).toBe(false)
    expect(message).toContain("entitlementFailures=1")
    expect(message).toContain("ownerSettlementFailures=4")
    expect(message).not.toContain("purchaseActivationFailures")
  })

  it("erro do serviço continua devolvendo Output inválido genérico", async () => {
    const useCase = new PaymentProviderMaintenanceUseCase({
      run: async () => {
        throw new Error("segredo interno")
      },
    })

    const output = await useCase.execute()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).not.toContain("segredo interno")
  })

  it("limite inválido é rejeitado sem chamar o serviço", async () => {
    const { useCase, run } = buildUseCase(CLEAN_RESULT)

    const output = await useCase.execute({ limit: 0 })

    expect(output.isValid).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })
})
