import { describe, expect, it, mock } from "bun:test"
import type { IPaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/IPaymentProviderConfigService"
import type { ProviderInstanceView } from "@/lib/payment-provider/admin-contract"
import {
  ProviderInstanceConflictError,
  ProviderInstanceNotFoundError,
  ProviderInstanceValidationError,
} from "@/lib/payment-provider/instance"
import { CredentialCipherError } from "@/lib/payment-provider/credential-cipher"
import { ProviderRoutingConfigError } from "@/lib/payment-provider/routing-config"
import { PaymentProviderConfigUseCase } from "./PaymentProviderConfigUseCase"

const actor = { profileId: "p1", backofficeUserId: "bo1", backofficeEmail: "dono@x.com" }
const view = { id: "i1" } as ProviderInstanceView
const SECRET = "sk_live_must_not_be_logged"

function build(overrides: Partial<IPaymentProviderConfigService> = {}) {
  const service = {
    list: async () => [view],
    get: async () => view,
    resolveLegacyTargetId: async () => "i1",
    listAdapters: () => ({ adapters: [] }),
    create: async () => ({ view, audit: null }),
    update: async () => ({
      view,
      audit: {
        action: "UPDATE" as const,
        entityId: "i1",
        operation: "provider_instance_updated",
        before: { killSwitch: false },
        after: { killSwitch: true },
        extra: { changedFields: ["killSwitch"] },
      },
    }),
    setCredential: async () => ({
      view,
      audit: {
        action: "CREATE" as const,
        entityId: "i1",
        operation: "provider_credential_created",
        before: { key: "API_KEY", isSet: false, last4: null },
        after: { key: "API_KEY", isSet: true, last4: "wxyz" },
        extra: { credentialKey: "API_KEY" },
      },
    }),
    deleteCredential: async () => ({ view, audit: null }),
    ...overrides,
  } as IPaymentProviderConfigService
  const logAudit = mock(async (_entry: unknown) => undefined)
  const listHistory = mock(async () => [
    { createdAt: new Date("2026-10-21T10:00:00.000Z"), actorProfileId: "p1", metadata: { operation: "provider_credential_created", credentialKey: "API_KEY", backofficeEmail: "dono@x.com" } },
  ])
  return { useCase: new PaymentProviderConfigUseCase(service, { logAudit, listHistory }), logAudit, listHistory }
}

describe("PaymentProviderConfigUseCase", () => {
  it("grava auditoria PAYMENT_PROVIDER_CONFIG com ator e sem segredo", async () => {
    const { useCase, logAudit } = build()
    const output = await useCase.setCredential({ configId: "i1", key: "API_KEY", value: SECRET }, actor)
    expect(output.isValid).toBe(true)
    const entry = logAudit.mock.calls[0][0] as Record<string, unknown>
    expect(entry).toMatchObject({ entityType: "PAYMENT_PROVIDER_CONFIG", entityId: "i1", action: "CREATE", actorProfileId: "p1" })
    expect(entry.metadata).toMatchObject({ operation: "provider_credential_created", backofficeEmail: "dono@x.com", credentialKey: "API_KEY" })
    expect(JSON.stringify([entry, output])).not.toContain(SECRET)
  })

  it("update audita o ator; sem mudança de credencial removida não audita", async () => {
    const { useCase, logAudit } = build()
    await useCase.update({ id: "i1", expectedRevision: 1, killSwitch: true }, actor)
    expect(logAudit).toHaveBeenCalledTimes(1)
    await useCase.deleteCredential({ configId: "i1", key: "API_KEY" }, actor)
    expect(logAudit).toHaveBeenCalledTimes(1)
  })

  it("corpo antigo resolve o id pela instância única; sem id nem par vira VALIDATION", async () => {
    const { useCase } = build()
    expect((await useCase.update({ provider: "ABACATE_PAY", environment: "PRODUCTION", expectedRevision: 1 }, actor)).isValid).toBe(true)
    const bad = await useCase.update({ expectedRevision: 1 }, actor)
    expect(bad.isValid).toBe(false)
    expect(bad.result).toEqual({ errorCode: "VALIDATION" })
  })

  it("falha ao salvar credencial: mensagem estável, INTERNAL e sem eco do valor", async () => {
    const cases: Array<[Error, string]> = [
      [new Error(`insert failed for value ${SECRET}`), "Não foi possível gravar a credencial"],
      [new CredentialCipherError(`PAYMENT_CREDENTIALS_ENCRYPTION_KEY ausente (${SECRET})`), "A chave de cifra das credenciais não está disponível"],
    ]
    for (const [failure, message] of cases) {
      const { useCase } = build({ setCredential: async () => { throw failure } })
      const output = await useCase.setCredential({ configId: "i1", key: "API_KEY", value: SECRET }, actor)
      expect(output.isValid).toBe(false)
      expect(output.result).toEqual({ errorCode: "INTERNAL" })
      expect(output.errorMessages).toEqual([message])
      expect(JSON.stringify(output)).not.toContain(SECRET)
    }
  })

  it("promoção a padrão inelegível vira CONFLICT (409) com a mensagem do motivo", async () => {
    const { useCase } = build({
      update: async () => {
        throw new ProviderInstanceConflictError("Esta instância ainda não pode ser o provider padrão: A instância está desativada.")
      },
    })
    const output = await useCase.update({ id: "i1", expectedRevision: 1, isDefault: true }, actor)
    expect(output.result).toEqual({ errorCode: "CONFLICT" })
    expect(output.errorMessages[0]).toContain("desativada")
  })

  it("mapeia erros de domínio para códigos", async () => {
    const cases: Array<[Error, string]> = [
      [new ProviderInstanceNotFoundError(), "NOT_FOUND"],
      [new ProviderInstanceConflictError("dup"), "CONFLICT"],
      [new ProviderInstanceValidationError("inválido"), "VALIDATION"],
      [new ProviderRoutingConfigError("REVISION_CONFLICT", "rev"), "CONFLICT"],
      [new ProviderRoutingConfigError("ACCOUNT_CONTEXT_INVALID", "ctx"), "VALIDATION"],
      [new Error(`db exploded ${SECRET}`), "INTERNAL"],
    ]
    for (const [error, code] of cases) {
      const { useCase } = build({ update: async () => { throw error } })
      const output = await useCase.update({ id: "i1", expectedRevision: 1 }, actor)
      expect(output.result).toEqual({ errorCode: code })
      expect(output.errorMessages.join()).not.toContain(SECRET)
    }
  })

  it("histórico lê o AuditLog da instância", async () => {
    const { useCase, listHistory } = build()
    const output = await useCase.history({ configId: "i1" })
    expect(listHistory).toHaveBeenCalledWith("PAYMENT_PROVIDER_CONFIG", "i1", 100)
    expect(output.result.items[0]).toMatchObject({ actor: "dono@x.com", operation: "provider_credential_created", summary: "Credencial criada: API_KEY" })
  })
})

describe("auditoria antes da gravação da credencial", () => {
  const draft = {
    action: "UPDATE" as const,
    entityId: "i1",
    operation: "provider_credential_rotated",
    before: { key: "API_KEY", isSet: true, last4: "abcd" },
    after: { key: "API_KEY", isSet: true, last4: "wxyz" },
  }

  it("entrega à service um sink que audita; falha na auditoria vira erro e a gravação não ocorre", async () => {
    let written = false
    const { useCase, logAudit } = build({
      setCredential: async (_input, _actor, recordAudit) => {
        await recordAudit?.(draft)
        written = true
        return { view, audit: null }
      },
    })
    logAudit.mockRejectedValueOnce(new Error("audit down"))
    const output = await useCase.setCredential({ configId: "i1", key: "API_KEY", value: SECRET }, actor)
    expect(output.isValid).toBe(false)
    expect(written).toBe(false)
  })

  it("auditoria ok: audita uma única vez, com o ator", async () => {
    const { useCase, logAudit } = build({
      deleteCredential: async (_id, _key, recordAudit) => {
        await recordAudit?.({ ...draft, action: "DELETE", operation: "provider_credential_deleted" })
        return { view, audit: null }
      },
    })
    const output = await useCase.deleteCredential({ configId: "i1", key: "API_KEY" }, actor)
    expect(output.isValid).toBe(true)
    expect(logAudit).toHaveBeenCalledTimes(1)
    expect(logAudit.mock.calls[0][0]).toMatchObject({ action: "DELETE", actorProfileId: "p1" })
  })
})
