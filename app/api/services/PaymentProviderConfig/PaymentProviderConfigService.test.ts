import { describe, expect, it, mock } from "bun:test"
import type {
  IPaymentProviderConfigRepository,
  UpdateProviderInstanceInput,
} from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type {
  IPaymentProviderCredentialRepository,
  UpsertCredentialInput,
} from "@/app/api/infra/data/repositories/paymentProviderCredential/IPaymentProviderCredentialRepository"
import { createCredentialCipher } from "@/lib/payment-provider/credential-cipher"
import { credentialContext } from "@/lib/payment-provider/credential-resolver"
import type { ProviderInstanceRecord, ProviderCredentialMeta } from "@/lib/payment-provider/instance"
import { applyProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"
import { PaymentProviderConfigService } from "./PaymentProviderConfigService"

const SECRET = "sk_live_TOP_SECRET_VALUE_9876543210"
const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: "e".repeat(64) } })

function record(overrides: Partial<ProviderInstanceRecord> = {}): ProviderInstanceRecord {
  return {
    id: "inst-1",
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    enabled: false,
    isDefault: false,
    externalAccountContext: "abacate-production",
    rolloutState: "DISABLED",
    killSwitch: false,
    revision: 1,
    healthStatus: "UNKNOWN",
    displayName: "Abacate Pay",
    logoUrl: null,
    logoAltText: null,
    settings: {},
    lastHealthCheckAt: null,
    lastErrorCode: null,
    ...overrides,
  }
}

function setup(initial: ProviderInstanceRecord[] = [record()]) {
  const instances = new Map(initial.map((item) => [item.id, item]))
  const metas = new Map<string, ProviderCredentialMeta[]>()
  const upserts: UpsertCredentialInput[] = []
  const onChange = mock(() => undefined)
  const configs: IPaymentProviderConfigRepository = {
    list: async (environment) => [...instances.values()].filter((i) => i.environment === environment),
    listAll: async () => [...instances.values()],
    findById: async (id) => instances.get(id) ?? null,
    findPrimary: async () => null,
    findByScope: async () => null,
    create: async (input) => {
      const created = record({
        id: `new-${instances.size}`,
        provider: input.provider,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
        displayName: input.displayName,
        logoUrl: input.logoUrl,
        logoAltText: input.logoAltText,
      })
      instances.set(created.id, created)
      return created
    },
    update: async (input: UpdateProviderInstanceInput) => {
      const current = instances.get(input.id) as ProviderInstanceRecord
      const routing = applyProviderRoutingConfigPatch(current, input.patch)
      const next = {
        ...current,
        ...routing,
        displayName: input.metadata?.displayName ?? current.displayName,
        logoUrl: input.metadata?.logoUrl !== undefined ? input.metadata.logoUrl : current.logoUrl,
        settings: { ...current.settings, ...(input.metadata?.settings ?? {}) },
      } as ProviderInstanceRecord
      input.assertNext?.(next)
      instances.set(next.id, next)
      return next
    },
    recordHealthCheck: async () => {
      throw new Error("not used")
    },
  }
  const credentials: IPaymentProviderCredentialRepository = {
    listMeta: async (configId) => metas.get(configId) ?? [],
    listMetaByConfigIds: async (ids) => new Map(ids.map((id) => [id, metas.get(id) ?? []])),
    listCiphertexts: async () => [],
    upsert: async (input) => {
      upserts.push(input)
      const list = metas.get(input.configId) ?? []
      const existed = list.some((meta) => meta.key === input.key)
      metas.set(input.configId, [
        ...list.filter((meta) => meta.key !== input.key),
        { key: input.key, last4: input.last4, fingerprint: input.fingerprint, updatedAt: new Date("2026-10-21T10:00:00.000Z") },
      ])
      return { existed }
    },
    delete: async (configId, key) => {
      const list = metas.get(configId) ?? []
      metas.set(configId, list.filter((meta) => meta.key !== key))
      return { deleted: list.some((meta) => meta.key === key) }
    },
  }
  const service = new PaymentProviderConfigService(configs, credentials, {
    getCipher: () => cipher,
    onChange,
    cardEnabledFallback: () => true,
  })
  return { service, upserts, onChange, instances }
}

describe("setCredential", () => {
  it("cifra o valor, não o devolve em lugar nenhum e audita sem segredo", async () => {
    const { service, upserts, onChange } = setup()
    const change = await service.setCredential({ configId: "inst-1", key: "API_KEY", value: `  ${SECRET}  ` }, "p1")
    expect(upserts).toHaveLength(1)
    expect(upserts[0].valueCiphertext).not.toContain(SECRET)
    expect(cipher.decrypt(upserts[0].valueCiphertext, credentialContext("inst-1", "API_KEY"))).toBe(SECRET)
    expect(upserts[0].updatedBy).toBe("p1")
    expect(JSON.stringify(change)).not.toContain(SECRET)
    expect(change.view.credentials.find((c) => c.key === "API_KEY")).toMatchObject({ isSet: true, last4: SECRET.slice(-4) })
    expect(change.audit).toMatchObject({ action: "CREATE", operation: "provider_credential_created" })
    expect(change.audit?.after).toEqual({ key: "API_KEY", isSet: true, last4: SECRET.slice(-4) })
    expect(onChange).toHaveBeenCalled()
  })

  it("segunda gravação da mesma chave é rotação", async () => {
    const { service } = setup()
    await service.setCredential({ configId: "inst-1", key: "API_KEY", value: SECRET }, null)
    const rotated = await service.setCredential({ configId: "inst-1", key: "API_KEY", value: `${SECRET}_NEW` }, null)
    expect(rotated.audit).toMatchObject({ action: "UPDATE", operation: "provider_credential_rotated" })
    expect(rotated.audit?.before).toMatchObject({ isSet: true })
  })

  it("valor vazio, só espaços, grande demais e chave inválida NÃO gravam nada", async () => {
    const { service, upserts, onChange } = setup()
    for (const value of ["", "   ", "x".repeat(4097)]) {
      await expect(service.setCredential({ configId: "inst-1", key: "API_KEY", value }, null)).rejects.toThrow()
    }
    await expect(service.setCredential({ configId: "inst-1", key: "api_key", value: SECRET }, null)).rejects.toThrow()
    expect(upserts).toHaveLength(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("BASE_URL (destino de rede) é rejeitada: a API key nunca segue URL editável", async () => {
    const { service, upserts } = setup()
    for (const key of ["BASE_URL", "API_HOST"]) {
      await expect(
        service.setCredential({ configId: "inst-1", key, value: "https://evil.example.com" }, null),
      ).rejects.toThrow("Nome de credencial inválido")
    }
    expect(upserts).toHaveLength(0)
  })

  it("aceita chave extra arbitrária e rejeita instância inexistente", async () => {
    const { service } = setup()
    const change = await service.setCredential({ configId: "inst-1", key: "MY_EXTRA_TOKEN", value: SECRET }, null)
    expect(change.view.credentials.some((c) => c.key === "MY_EXTRA_TOKEN" && !c.required)).toBe(true)
    await expect(service.setCredential({ configId: "nope", key: "API_KEY", value: SECRET }, null)).rejects.toThrow()
  })
})

describe("deleteCredential", () => {
  it("remove e audita; remover o que não existe não audita", async () => {
    const { service } = setup()
    await service.setCredential({ configId: "inst-1", key: "API_KEY", value: SECRET }, null)
    const removed = await service.deleteCredential("inst-1", "API_KEY")
    expect(removed.audit).toMatchObject({ action: "DELETE", operation: "provider_credential_deleted" })
    expect(removed.view.credentials.find((c) => c.key === "API_KEY")?.isSet).toBe(false)
    expect((await service.deleteCredential("inst-1", "API_KEY")).audit).toBeNull()
  })
})

describe("instância somente de credencial (T019)", () => {
  const asaas = () => record({ id: "asaas-1", provider: "ASAAS", externalAccountContext: "primary", displayName: "Asaas" })

  it("não pode ser padrão nem passar de SANDBOX_VALIDATED", async () => {
    const { service } = setup([asaas()])
    await expect(service.update({ id: "asaas-1", expectedRevision: 1, isDefault: true })).rejects.toThrow("somente de credencial")
    await expect(
      service.update({ id: "asaas-1", expectedRevision: 1, rolloutState: "SANDBOX_VALIDATED" }),
    ).resolves.toBeDefined()
    await expect(service.update({ id: "asaas-1", expectedRevision: 2, rolloutState: "APPROVED" })).rejects.toThrow("somente de credencial")
  })

  it("a view marca paymentCapable=false", async () => {
    const { service } = setup([asaas()])
    expect((await service.get("asaas-1")).paymentCapable).toBe(false)
  })
})

describe("update e create", () => {
  it("audita só os campos alterados (kill switch, default, nome, settings) sem segredo", async () => {
    const { service } = setup()
    const change = await service.update({
      id: "inst-1",
      expectedRevision: 1,
      killSwitch: true,
      displayName: "Novo nome",
      settings: { requireSignature: true },
    })
    expect(change.audit?.extra?.changedFields).toEqual(["displayName", "killSwitch", "requireSignature"])
    expect(change.view.settings.requireSignature).toBe(true)
  })

  it("revisão desatualizada lança conflito", async () => {
    const { service } = setup()
    await expect(service.update({ id: "inst-1", expectedRevision: 9 })).rejects.toThrow("desatualizada")
  })

  it("valida logo (https) e nome no update e na criação", async () => {
    const { service } = setup()
    await expect(service.update({ id: "inst-1", expectedRevision: 1, logoUrl: "javascript:void(0)" })).rejects.toThrow()
    await expect(
      service.create({ providerKey: "ASAAS", environment: "DEV", externalAccountContext: "primary", displayName: "  " }),
    ).rejects.toThrow()
    const created = await service.create({
      providerKey: "ASAAS",
      environment: "DEV",
      externalAccountContext: "primary",
      displayName: "Asaas",
      logoUrl: "https://cdn.example.com/a.png",
    })
    expect(created.view.logoUrl).toBe("https://cdn.example.com/a.png")
    expect(created.audit).toMatchObject({ action: "CREATE", operation: "provider_instance_created" })
  })

  it("corpo antigo só resolve com uma única instância", async () => {
    const { service } = setup([record(), record({ id: "inst-2", externalAccountContext: "abacate-production-2" })])
    await expect(service.resolveLegacyTargetId("ABACATE_PAY", "PRODUCTION")).rejects.toThrow("mais de uma")
    await expect(service.resolveLegacyTargetId("ASAAS", "PRODUCTION")).rejects.toThrow()
  })

  it("listAdapters expõe o schema por adapter", () => {
    const { service } = setup()
    const adapters = service.listAdapters().adapters
    expect(adapters.find((a) => a.providerKey === "ASAAS")?.paymentCapable).toBe(false)
    expect(adapters.find((a) => a.providerKey === "ABACATE_PAY")?.credentialSchema.map((f) => f.key)).toContain("WEBHOOK_SECRET_PREVIOUS")
  })
})
