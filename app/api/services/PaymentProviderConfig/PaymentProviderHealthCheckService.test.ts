import { describe, expect, it } from "bun:test"
import type { RecordProviderHealthCheckInput } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type { HealthCheckCapability } from "@/lib/payment-provider/contracts"
import type { ProviderInstanceRecord } from "@/lib/payment-provider/instance"
import { PaymentProviderHealthCheckService } from "./PaymentProviderHealthCheckService"

const SECRET = "sk_live_should_never_leak"
const checkedAt = new Date("2026-10-20T12:00:00.000Z")

function instance(overrides: Partial<ProviderInstanceRecord> = {}): ProviderInstanceRecord {
  return {
    id: "i1",
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    enabled: true,
    isDefault: true,
    externalAccountContext: "abacate-production",
    rolloutState: "ACTIVE",
    killSwitch: false,
    revision: 1,
    healthStatus: "HEALTHY",
    displayName: "Abacate",
    logoUrl: null,
    logoAltText: null,
    settings: {},
    lastHealthCheckAt: null,
    lastErrorCode: null,
    ...overrides,
  }
}

function setup(options: {
  instances?: ProviderInstanceRecord[]
  provider?: HealthCheckCapability
  factoryError?: Error
}) {
  const store = new Map((options.instances ?? [instance()]).map((item) => [item.id, item]))
  const recorded: RecordProviderHealthCheckInput[] = []
  const repository = {
    list: async () => [],
    listAll: async () => [...store.values()],
    findById: async (id: string) => store.get(id) ?? null,
    findPrimary: async () => null,
    findByScope: async () => null,
    create: async () => {
      throw new Error("not used")
    },
    update: async () => {
      throw new Error("not used")
    },
    recordHealthCheck: async (input: RecordProviderHealthCheckInput) => {
      recorded.push(input)
      const current = store.get(input.id) as ProviderInstanceRecord
      const next = {
        ...current,
        healthStatus: input.healthStatus ?? current.healthStatus,
        lastErrorCode: input.errorCode,
      }
      store.set(input.id, next)
      return next
    },
  }
  const service = new PaymentProviderHealthCheckService(
    repository,
    async () => {
      if (options.factoryError) throw options.factoryError
      return options.provider as HealthCheckCapability
    },
    () => checkedAt,
  )
  return { service, recorded, store }
}

const failing: HealthCheckCapability = {
  checkHealth: async () => ({ healthy: false, errorCode: "AUTHENTICATION_FAILED", errorMessage: "recusou" }),
}

describe("PaymentProviderHealthCheckService", () => {
  it("manual grava HEALTHY e limpa o erro quando a sondagem passa", async () => {
    const { service, recorded } = setup({
      instances: [instance({ healthStatus: "UNHEALTHY", lastErrorCode: "X" })],
      provider: { checkHealth: async () => ({ healthy: true }) },
    })
    const result = await service.check({ id: "i1" })
    expect(result.healthStatus).toBe("HEALTHY")
    expect(recorded[0]).toEqual({
      id: "i1",
      healthStatus: "HEALTHY",
      checkedAt,
      errorCode: null,
      errorMessage: null,
    })
  })

  it("manual grava UNHEALTHY na hora, com código e mensagem seguros", async () => {
    const { service, recorded } = setup({ provider: failing })
    await service.check({ id: "i1" })
    expect(recorded[0]).toMatchObject({ healthStatus: "UNHEALTHY", errorCode: "AUTHENTICATION_FAILED" })
  })

  it("não vaza segredo quando a credencial não existe ou a sondagem lança", async () => {
    const a = setup({ factoryError: new Error(`missing ${SECRET}`) })
    await a.service.check({ id: "i1" })
    expect(a.recorded[0].errorCode).toBe("CONFIGURATION_INVALID")
    const b = setup({
      provider: {
        checkHealth: async () => {
          throw new Error(`boom ${SECRET}`)
        },
      },
    })
    await b.service.check({ id: "i1" })
    expect(b.recorded[0].healthStatus).toBe("UNHEALTHY")
    expect(JSON.stringify([a.recorded, b.recorded])).not.toContain(SECRET)
  })

  it("instância inexistente não grava nada", async () => {
    const { service, recorded } = setup({ provider: failing })
    await expect(service.check({ id: "nope" })).rejects.toThrow()
    expect(recorded).toHaveLength(0)
  })

  it("agendado: a primeira falha mantém o status; a segunda seguida degrada", async () => {
    const { service, recorded, store } = setup({ provider: failing })
    await service.check({ id: "i1", mode: "scheduled" })
    expect(recorded[0].healthStatus).toBeNull()
    expect(store.get("i1")?.healthStatus).toBe("HEALTHY")
    await service.check({ id: "i1", mode: "scheduled" })
    expect(recorded[1].healthStatus).toBe("UNHEALTHY")
  })

  it("checkAll sinaliza só instâncias que acabaram de degradar e ignora as desligadas", async () => {
    const { service } = setup({
      provider: failing,
      instances: [
        instance({ id: "a", lastErrorCode: "AUTHENTICATION_FAILED" }),
        instance({ id: "b" }),
        instance({ id: "c", enabled: false, rolloutState: "DISABLED" }),
        instance({ id: "d", killSwitch: true }),
      ],
    })
    const summary = await service.checkAll()
    expect(summary.checked).toBe(2)
    expect(summary.failing).toBe(2)
    expect(summary.degraded.map((item) => item.id)).toEqual(["a"])
  })
})
