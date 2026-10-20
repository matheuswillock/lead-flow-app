import { describe, expect, it } from "bun:test"
import type { RecordProviderHealthCheckInput } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type { HealthCheckCapability } from "@/lib/payment-provider/contracts"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"
import { PaymentProviderHealthCheckService } from "./PaymentProviderHealthCheckService"

const SECRET = "sk_live_should_never_leak"
const checkedAt = new Date("2026-10-20T12:00:00.000Z")

function setup(options: { provider?: HealthCheckCapability; factoryError?: Error }) {
  const recorded: RecordProviderHealthCheckInput[] = []
  const repository = {
    list: async () => [],
    update: async () => {
      throw new Error("not used")
    },
    recordHealthCheck: async (input: RecordProviderHealthCheckInput) => {
      recorded.push(input)
      return { healthStatus: input.healthStatus } as ProviderRoutingConfigRecord
    },
  }
  const service = new PaymentProviderHealthCheckService(
    repository,
    () => {
      if (options.factoryError) throw options.factoryError
      return options.provider as HealthCheckCapability
    },
    () => checkedAt,
  )
  return { service, recorded }
}

describe("PaymentProviderHealthCheckService", () => {
  it("grava HEALTHY e limpa o erro quando a sondagem passa", async () => {
    const { service, recorded } = setup({
      provider: { checkHealth: async () => ({ healthy: true }) },
    })

    const result = await service.check({ provider: "ABACATE_PAY", environment: "PRODUCTION" })

    expect(result.healthStatus).toBe("HEALTHY")
    expect(recorded).toEqual([
      {
        provider: "ABACATE_PAY",
        environment: "PRODUCTION",
        healthStatus: "HEALTHY",
        checkedAt,
        errorCode: null,
        errorMessage: null,
      },
    ])
  })

  it("grava UNHEALTHY com código e mensagem seguros quando a sondagem falha", async () => {
    const { service, recorded } = setup({
      provider: {
        checkHealth: async () => ({
          healthy: false,
          errorCode: "AUTHENTICATION_FAILED",
          errorMessage: "O provedor recusou a operação",
        }),
      },
    })

    await service.check({ provider: "ABACATE_PAY", environment: "PRODUCTION" })

    expect(recorded[0]).toMatchObject({
      healthStatus: "UNHEALTHY",
      errorCode: "AUTHENTICATION_FAILED",
      errorMessage: "O provedor recusou a operação",
    })
  })

  it("grava UNHEALTHY sem vazar segredo quando a credencial não existe", async () => {
    const { service, recorded } = setup({ factoryError: new Error(`missing ${SECRET}`) })

    await service.check({ provider: "ABACATE_PAY", environment: "PRODUCTION" })

    expect(recorded[0].healthStatus).toBe("UNHEALTHY")
    expect(recorded[0].errorCode).toBe("CONFIGURATION_INVALID")
    expect(JSON.stringify(recorded[0])).not.toContain(SECRET)
  })

  it("grava UNHEALTHY sem vazar segredo quando a sondagem lança", async () => {
    const { service, recorded } = setup({
      provider: {
        checkHealth: async () => {
          throw new Error(`boom ${SECRET}`)
        },
      },
    })

    await service.check({ provider: "ABACATE_PAY", environment: "PRODUCTION" })

    expect(recorded[0].healthStatus).toBe("UNHEALTHY")
    expect(JSON.stringify(recorded[0])).not.toContain(SECRET)
  })

  it("rejeita provider sem sondagem suportada sem gravar nada", async () => {
    const { service, recorded } = setup({})

    await expect(service.check({ provider: "ASAAS", environment: "PRODUCTION" })).rejects.toThrow(
      "Health-check não suportado",
    )
    expect(recorded).toHaveLength(0)
  })
})
