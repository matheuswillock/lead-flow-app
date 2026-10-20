import { describe, expect, it, mock } from "bun:test"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"
import { PaymentProviderHealthCheckUseCase } from "./PaymentProviderHealthCheckUseCase"

const actor = { profileId: "profile-1", backofficeUserId: "bo-1" }
const record = { healthStatus: "HEALTHY", revision: 3 } as ProviderRoutingConfigRecord

describe("PaymentProviderHealthCheckUseCase", () => {
  it("devolve o registro atualizado e audita o ator sem dados sensíveis", async () => {
    const info = mock(() => undefined)
    const useCase = new PaymentProviderHealthCheckUseCase({ check: async () => record }, { info })

    const output = await useCase.check({
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      actor,
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual(record)
    expect(info).toHaveBeenCalledTimes(1)
    const [, context] = info.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(context).toMatchObject({
      actorProfileId: "profile-1",
      actorBackofficeUserId: "bo-1",
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      healthStatus: "HEALTHY",
    })
  })

  it("devolve Output inválido quando o service falha", async () => {
    const useCase = new PaymentProviderHealthCheckUseCase(
      {
        check: async () => {
          throw new Error("Configuração do provider não encontrada")
        },
      },
      { info: () => undefined },
    )

    const output = await useCase.check({
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      actor,
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Configuração do provider não encontrada")
  })
})
