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
import { ProviderInstanceConflictError } from "@/lib/payment-provider/instance"
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

function setup(initial: ProviderInstanceRecord[] = [record()], env: Record<string, string> = {}) {
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
    env: () => env,
  })
  return { service, upserts, onChange, instances, metas }
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

describe("trilha de auditoria antes da gravação da credencial", () => {
  it("registra a trilha ANTES de gravar e não devolve rascunho duplicado", async () => {
    const { service, upserts } = setup()
    const order: string[] = []
    const change = await service.setCredential(
      { configId: "inst-1", key: "API_KEY", value: SECRET },
      "p1",
      async (draft) => {
        order.push(`audit:${upserts.length}:${draft.operation}`)
      },
    )
    expect(order).toEqual(["audit:0:provider_credential_created"])
    expect(upserts).toHaveLength(1)
    expect(change.audit).toBeNull()
  })

  it("auditoria que falha impede a gravação e a invalidação do cache (falha fechada)", async () => {
    const { service, upserts, onChange } = setup()
    await expect(
      service.setCredential({ configId: "inst-1", key: "API_KEY", value: SECRET }, "p1", async () => {
        throw new Error("audit down")
      }),
    ).rejects.toThrow("audit down")
    expect(upserts).toHaveLength(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("remoção: auditoria que falha mantém a credencial", async () => {
    const { service } = setup()
    await service.setCredential({ configId: "inst-1", key: "API_KEY", value: SECRET }, null)
    await expect(
      service.deleteCredential("inst-1", "API_KEY", async () => {
        throw new Error("audit down")
      }),
    ).rejects.toThrow("audit down")
    const view = await service.get("inst-1")
    expect(view.credentials.find((c) => c.key === "API_KEY")?.isSet).toBe(true)
  })
})

describe("remoção de credencial obrigatória", () => {
  async function withCredentials(overrides: Partial<ProviderInstanceRecord>) {
    const ctx = setup([record(overrides)])
    await ctx.service.setCredential({ configId: "inst-1", key: "API_KEY", value: SECRET }, null)
    await ctx.service.setCredential({ configId: "inst-1", key: "EXTRA_TOKEN", value: SECRET }, null)
    return ctx
  }

  it("bloqueia (conflito) a remoção de API_KEY de instância habilitada", async () => {
    const { service } = await withCredentials({ enabled: true })
    await expect(service.deleteCredential("inst-1", "API_KEY")).rejects.toBeInstanceOf(
      ProviderInstanceConflictError,
    )
    expect((await service.get("inst-1")).credentials.find((c) => c.key === "API_KEY")?.isSet).toBe(true)
  })

  it("bloqueia também instância ACTIVE", async () => {
    const { service } = await withCredentials({ rolloutState: "ACTIVE" })
    await expect(service.deleteCredential("inst-1", "API_KEY")).rejects.toBeInstanceOf(
      ProviderInstanceConflictError,
    )
  })

  it("permite remover obrigatória de instância desabilitada e opcional de qualquer instância", async () => {
    const disabled = await withCredentials({})
    expect((await disabled.service.deleteCredential("inst-1", "API_KEY")).audit?.operation).toBe(
      "provider_credential_deleted",
    )
    const enabled = await withCredentials({ enabled: true })
    expect((await enabled.service.deleteCredential("inst-1", "EXTRA_TOKEN")).audit).not.toBeNull()
  })
})

describe("promoção a provider padrão (elegibilidade)", () => {
  const meta = (key: string): ProviderCredentialMeta => ({
    key,
    last4: null,
    fingerprint: "ffffffffffff",
    updatedAt: new Date("2026-10-21T10:00:00.000Z"),
  })

  it("RECUSA (409) instância desativada e sem credencial obrigatória, listando o que falta", async () => {
    const { service, instances } = setup()
    const error = await service.update({ id: "inst-1", expectedRevision: 1, isDefault: true }).catch((e) => e)
    expect(error.name).toBe("ProviderInstanceConflictError")
    expect(error.message).toContain("A instância está desativada.")
    expect(error.message).toContain("O rollout precisa estar ACTIVE (atual: DISABLED).")
    expect(error.message).toContain("Falta a credencial obrigatória Chave de API (API_KEY).")
    expect(error.message).toContain("Falta a credencial obrigatória Segredo do webhook (WEBHOOK_SECRET).")
    expect(instances.get("inst-1")?.isDefault).toBe(false)
  })

  it("recusa com kill switch ligado mesmo estando habilitada, ACTIVE e com credenciais", async () => {
    const { service, metas } = setup([
      record({ enabled: true, rolloutState: "ACTIVE", killSwitch: true, revision: 3 }),
    ])
    metas.set("inst-1", [meta("API_KEY"), meta("WEBHOOK_SECRET")])
    await expect(service.update({ id: "inst-1", expectedRevision: 3, isDefault: true })).rejects.toThrow(
      "O kill switch está ligado.",
    )
  })

  it("aceita instância elegível: habilitada, ACTIVE, sem kill switch e com as credenciais no banco", async () => {
    const { service, metas } = setup([record({ enabled: true, rolloutState: "ACTIVE", revision: 3 })])
    metas.set("inst-1", [meta("API_KEY"), meta("WEBHOOK_SECRET")])
    const change = await service.update({ id: "inst-1", expectedRevision: 3, isDefault: true })
    expect(change.view.isDefault).toBe(true)
    expect(change.view.defaultBlockers).toEqual([])
  })

  it("a reserva de ambiente conta para a instância principal, mas não para uma secundária", async () => {
    const env = { ABACATE_PAY_PRODUCTION_API_KEY: "x", ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET: "y" }
    const primary = record({ id: "a", displayName: "A", enabled: true, rolloutState: "ACTIVE", revision: 3, isDefault: false })
    const { service } = setup([primary], env)
    expect((await service.update({ id: "a", expectedRevision: 3, isDefault: true })).view.isDefault).toBe(true)

    const second = record({ id: "b", displayName: "B", externalAccountContext: "conta-2", enabled: true, rolloutState: "ACTIVE", revision: 3 })
    const both = setup([record({ id: "a", displayName: "A", enabled: true, rolloutState: "ACTIVE", revision: 3, isDefault: true, healthStatus: "HEALTHY" }), second], env)
    const view = (await both.service.list("PRODUCTION")).find((item) => item.id === "b")
    expect(view?.defaultBlockers.join(" ")).toContain("API_KEY")
  })

  it("instância somente de credencial (Asaas) nunca pode ser padrão: motivo aparece em defaultBlockers", async () => {
    const asaas = record({ id: "s1", provider: "ASAAS", externalAccountContext: "primary", displayName: "Asaas" })
    const { service } = setup([asaas])
    const view = await service.get("s1")
    expect(view.defaultBlockers.join(" ")).toContain("não tem capacidade de pagamento")
  })

  it("defaultBlockers vem vazio quando pode ser padrão", async () => {
    const { service, metas } = setup([record({ enabled: true, rolloutState: "ACTIVE" })])
    metas.set("inst-1", [meta("API_KEY"), meta("WEBHOOK_SECRET")])
    expect((await service.get("inst-1")).defaultBlockers).toEqual([])
  })

  it("o fluxo de ativação continua: os passos anteriores (sem isDefault) não exigem elegibilidade", async () => {
    const { service } = setup()
    const step = await service.update({ id: "inst-1", expectedRevision: 1, rolloutState: "SANDBOX_VALIDATED" })
    expect(step.view.rolloutState).toBe("SANDBOX_VALIDATED")
  })

  it("o passo final da ativação (ACTIVE + enabled + isDefault no mesmo patch) passa com credenciais", async () => {
    const { service, metas } = setup([record({ rolloutState: "APPROVED", revision: 3 })])
    metas.set("inst-1", [meta("API_KEY"), meta("WEBHOOK_SECRET")])
    const change = await service.update({ id: "inst-1", expectedRevision: 3, rolloutState: "ACTIVE", enabled: true, isDefault: true })
    expect(change.view).toMatchObject({ isDefault: true, enabled: true, rolloutState: "ACTIVE" })
  })

  it("o passo final SEM credenciais é recusado (regra não relaxada)", async () => {
    const { service } = setup([record({ rolloutState: "APPROVED", revision: 3 })])
    await expect(
      service.update({ id: "inst-1", expectedRevision: 3, rolloutState: "ACTIVE", enabled: true, isDefault: true }),
    ).rejects.toThrow("Falta a credencial obrigatória")
  })
})

describe("campos de política e settings aplicáveis", () => {
  it("REQUIRE_SIGNATURE não aparece em credentials da view nem no schema de GET /adapters", async () => {
    const { service, metas } = setup()
    metas.set("inst-1", [
      { key: "REQUIRE_SIGNATURE", last4: null, fingerprint: "ffffffffffff", updatedAt: new Date() },
    ])
    const view = await service.get("inst-1")
    expect(view.credentials.map((c) => c.key)).not.toContain("REQUIRE_SIGNATURE")
    const abacate = service.listAdapters().adapters.find((a) => a.providerKey === "ABACATE_PAY")
    expect(abacate?.credentialSchema.map((f) => f.key)).not.toContain("REQUIRE_SIGNATURE")
    expect(abacate?.credentialSchema.map((f) => f.key)).toContain("API_KEY")
  })

  it("applicableSettings: Abacate ambos, Asaas nenhum (view e adapters)", async () => {
    const { service } = setup([
      record(),
      record({ id: "s1", provider: "ASAAS", externalAccountContext: "primary", displayName: "Asaas" }),
    ])
    expect((await service.get("inst-1")).applicableSettings).toEqual(["requireSignature", "cardEnabled"])
    expect((await service.get("s1")).applicableSettings).toEqual([])
    const adapters = service.listAdapters().adapters
    expect(adapters.find((a) => a.providerKey === "ASAAS")?.applicableSettings).toEqual([])
    expect(adapters.find((a) => a.providerKey === "ABACATE_PAY")?.applicableSettings).toEqual([
      "requireSignature",
      "cardEnabled",
    ])
  })

  it("PUT rejeita setting não aplicável ao adapter (Asaas) e não grava", async () => {
    const { service, instances } = setup([
      record(),
      record({ id: "s1", provider: "ASAAS", externalAccountContext: "primary", displayName: "Asaas" }),
    ])
    for (const settings of [{ cardEnabled: false }, { requireSignature: true }]) {
      const error = await service.update({ id: "s1", expectedRevision: 1, settings }).catch((e) => e)
      expect(error.name).toBe("ProviderInstanceValidationError")
      expect(error.message).toContain("não se aplica")
    }
    expect(instances.get("s1")?.settings).toEqual({})
    await expect(service.update({ id: "inst-1", expectedRevision: 1, settings: { cardEnabled: false } })).resolves.toBeDefined()
  })
})

describe("ordem estável da lista", () => {
  it("ordena por nome de exibição e id, independente da ordem do repositório e de edições", async () => {
    const { service } = setup([
      record({ id: "c", displayName: "Zeta", externalAccountContext: "z" }),
      record({ id: "b", displayName: "alfa", externalAccountContext: "b" }),
      record({ id: "a", displayName: "alfa", externalAccountContext: "a" }),
    ])
    const ids = async () => (await service.list("PRODUCTION")).map((item) => item.id)
    expect(await ids()).toEqual(["a", "b", "c"])
    await service.update({ id: "c", expectedRevision: 1, killSwitch: true })
    await service.update({ id: "a", expectedRevision: 1, killSwitch: true })
    expect(await ids()).toEqual(["a", "b", "c"])
  })
})
