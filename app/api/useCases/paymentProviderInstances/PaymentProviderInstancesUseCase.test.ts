import { describe, expect, it, mock } from "bun:test"
import type { IPaymentProviderCredentialRepository } from "@/app/api/infra/data/repositories/paymentProviderCredential/IPaymentProviderCredentialRepository"
import { PaymentProviderInstancesUseCase } from "./PaymentProviderInstancesUseCase"

const record = {
  id: "config-1",
  provider: "ABACATE_PAY" as const,
  environment: "DEV" as const,
  displayName: "Abacate dev",
  externalAccountContext: "abacate-dev",
  enabled: false,
  rolloutState: "DISABLED",
  isDefault: false,
  healthStatus: "UNKNOWN",
  lastHealthCheckAt: null,
  logoUrl: null,
  logoAltText: null,
  credentials: { API_KEY: { isSet: true as const, last4: "1234", fingerprint: "sha256:abcd" } },
}

function repository(overrides: Partial<IPaymentProviderCredentialRepository> = {}) {
  return {
    list: mock(async () => [record]),
    create: mock(async () => record),
    getEncrypted: mock(async () => null),
    ...overrides,
  } as IPaymentProviderCredentialRepository
}

describe("PaymentProviderInstancesUseCase", () => {
  it("lists credential metadata without ciphertext and marks Asaas as non-selectable", async () => {
    const asaas = { ...record, provider: "ASAAS" as const, credentials: {} }
    const useCase = new PaymentProviderInstancesUseCase(repository({ list: async () => [asaas] }))

    const result = await useCase.list("DEV")

    expect(result.result).toMatchObject([{ isSelectable: false, capabilities: [], credentials: {} }])
    expect(JSON.stringify(result.result)).not.toContain("Ciphertext")
  })

  it("rejects Asaas as default because it has no routing capabilities", async () => {
    const create = mock(async () => record)
    const useCase = new PaymentProviderInstancesUseCase(repository({ create }))

    const result = await useCase.create({
      provider: "ASAAS",
      environment: "DEV",
      displayName: "Asaas",
      externalAccountContext: "primary",
      isDefault: true,
      credentials: { API_KEY: "aact_secret" },
      actorProfileId: "profile-1",
    })

    expect(result.isValid).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it("requires descriptor credentials and validates HTTPS branding URLs", async () => {
    const create = mock(async () => record)
    const useCase = new PaymentProviderInstancesUseCase(repository({ create }))
    const result = await useCase.create({
      provider: "ABACATE_PAY",
      environment: "DEV",
      displayName: "Abacate",
      externalAccountContext: "dev",
      isDefault: false,
      logoUrl: "javascript:void(0)",
      credentials: { API_KEY: "secret" },
      actorProfileId: "profile-1",
    })

    expect(result.isValid).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it("decisão 16: credencial salva com sucesso nunca ecoa o valor na resposta nem na auditoria", async () => {
    const secret = "sk_live_super_secreto_12345"
    const create = mock(async () => record)
    const logAudit = mock(async (_entry: { after: unknown; metadata: unknown }) => undefined)
    const useCase = new PaymentProviderInstancesUseCase(repository({ create }), { logAudit })

    const result = await useCase.create({
      provider: "ABACATE_PAY",
      environment: "DEV",
      displayName: "Abacate",
      externalAccountContext: "dev",
      isDefault: false,
      credentials: { API_KEY: secret, WEBHOOK_SECRET: "whsec_outro_segredo", PUBLIC_KEY: "pk_dev_outra_chave" },
      actorProfileId: "profile-1",
    })

    expect(result.isValid).toBe(true)
    expect(JSON.stringify(result.result)).not.toContain(secret)
    expect(logAudit).toHaveBeenCalled()
    const auditCall = logAudit.mock.calls[0]?.[0]
    expect(JSON.stringify(auditCall?.after)).not.toContain(secret)
    expect(auditCall?.metadata).toMatchObject({ credentialValuesOmitted: true })
  })
})
