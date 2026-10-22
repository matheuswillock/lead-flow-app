import { describe, expect, it, mock } from "bun:test"
import type { ProviderInstanceView } from "@/lib/payment-provider/admin-contract"
import { PaymentProviderHealthCheckUseCase } from "./PaymentProviderHealthCheckUseCase"

const actor = { profileId: "profile-1", backofficeUserId: "bo-1" }
const view = { id: "i1", providerKey: "ABACATE_PAY", environment: "PRODUCTION", healthStatus: "HEALTHY" } as ProviderInstanceView
const instances = { get: async () => view, resolveLegacyTargetId: async () => "i1" }

describe("PaymentProviderHealthCheckUseCase", () => {
  it("devolve a view atualizada e audita o ator sem dados sensíveis", async () => {
    const info = mock(() => undefined)
    const useCase = new PaymentProviderHealthCheckUseCase({ check: (async () => ({})) as never, checkAll: async () => ({}) as never }, instances, { info })
    const output = await useCase.check({ id: "i1", actor })
    expect(output.isValid).toBe(true)
    expect(output.result).toEqual(view)
    const [, context] = info.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(context).toMatchObject({ actorProfileId: "profile-1", instanceId: "i1", healthStatus: "HEALTHY" })
  })

  it("aceita o corpo antigo (provider + environment)", async () => {
    const check = mock(async (_input: unknown) => ({}))
    const useCase = new PaymentProviderHealthCheckUseCase({ check: check as never, checkAll: async () => ({}) as never }, instances, { info: () => undefined })
    await useCase.check({ provider: "ABACATE_PAY", environment: "PRODUCTION", actor })
    expect(check).toHaveBeenCalledWith({ id: "i1", mode: "manual" })
  })

  it("devolve Output inválido quando o service falha", async () => {
    const useCase = new PaymentProviderHealthCheckUseCase(
      { check: async () => { throw new Error("Instância do provider não encontrada") }, checkAll: async () => ({}) as never },
      instances,
      { info: () => undefined },
    )
    const output = await useCase.check({ id: "x", actor })
    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Instância do provider não encontrada")
  })
})
