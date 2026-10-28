import { describe, expect, it, mock } from "bun:test"
import type { IPaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/IPaymentProviderConfigService"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"
import { PaymentProviderConfigUseCase } from "./PaymentProviderConfigUseCase"

const record: ProviderRoutingConfigRecord = {
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  enabled: true,
  isDefault: true,
  externalAccountContext: "abacate-production",
  rolloutState: "ACTIVE",
  killSwitch: false,
  cardEnabled: true,
  revision: 4,
  healthStatus: "HEALTHY",
}

const actor = { profileId: "profile-1", backofficeUserId: "backoffice-1" }

function build(update: IPaymentProviderConfigService["update"]) {
  const audit = { info: mock((_message: string, _context: Record<string, unknown>) => undefined) }
  const onConfigUpdated = mock(() => undefined)
  const service: IPaymentProviderConfigService = { list: async () => [record], update }
  const useCase = new PaymentProviderConfigUseCase(service, { audit, onConfigUpdated })
  return { useCase, audit, onConfigUpdated }
}

describe("PaymentProviderConfigUseCase.update", () => {
  it("devolve o registro com cardEnabled e invalida o cache do cartão", async () => {
    const { useCase, onConfigUpdated } = build(async () => record)

    const output = await useCase.update({
      environment: "PRODUCTION",
      provider: "ABACATE_PAY",
      patch: { cardEnabled: true, expectedRevision: 3 },
      actor,
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ cardEnabled: true, revision: 4 })
    expect(onConfigUpdated).toHaveBeenCalledTimes(1)
  })

  it("audita o ator, o cardEnabled e os campos alterados sem dados sensíveis", async () => {
    const { useCase, audit } = build(async () => record)

    await useCase.update({
      environment: "PRODUCTION",
      provider: "ABACATE_PAY",
      patch: { cardEnabled: true, expectedRevision: 3 },
      actor,
    })

    expect(audit.info).toHaveBeenCalledTimes(1)
    expect(audit.info.mock.calls[0]?.[1]).toEqual({
      actorProfileId: "profile-1",
      actorBackofficeUserId: "backoffice-1",
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      changedFields: ["cardEnabled"],
      cardEnabled: true,
      revision: 4,
    })
  })

  it("não invalida o cache nem audita quando a atualização falha", async () => {
    const { useCase, audit, onConfigUpdated } = build(async () => {
      throw new Error("A revisão da configuração está desatualizada")
    })

    const output = await useCase.update({
      environment: "PRODUCTION",
      provider: "ABACATE_PAY",
      patch: { cardEnabled: true, expectedRevision: 1 },
      actor,
    })

    expect(output.isValid).toBe(false)
    expect(onConfigUpdated).not.toHaveBeenCalled()
    expect(audit.info).not.toHaveBeenCalled()
  })
})
