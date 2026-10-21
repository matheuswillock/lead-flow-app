import { describe, expect, it, mock } from "bun:test"
import { CredentialCache } from "./credential-cache"
import { createCredentialCipher } from "./credential-cipher"
import {
  createCredentialResolver,
  credentialContext,
  type CredentialResolverDeps,
} from "./credential-resolver"

const KEY = "c".repeat(64)
const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY } })
const CONFIG_ID = "cfg-1"
const DB_SECRET = "db_api_key_value_0001"
const ENV_SECRET = "env_api_key_value_0002"
const selector = { provider: "ABACATE_PAY", environment: "PRODUCTION" } as const

function setup(options: {
  stored?: Record<string, string>
  env?: Record<string, string>
  instance?: boolean
  dbFails?: boolean
  now?: { value: number }
}) {
  const clock = options.now ?? { value: 0 }
  const logs: Array<{ event: string; fields: Record<string, unknown> }> = []
  const findInstance = mock(async () => {
    if (options.dbFails) throw new Error("connection refused")
    return options.instance === false
      ? null
      : { id: CONFIG_ID, externalAccountContext: "abacate-production", settings: { requireSignature: true } }
  })
  const loadStored = mock(async () =>
    Object.entries(options.stored ?? {}).map(([key, value]) => ({
      key,
      valueCiphertext: cipher.encrypt(value, credentialContext(CONFIG_ID, key)),
    })),
  )
  const deps: CredentialResolverDeps = {
    findInstance,
    loadStored,
    decrypt: (payload, context) => cipher.decrypt(payload, context),
    env: () => options.env ?? {},
    cache: new CredentialCache(30_000, () => clock.value),
    log: (event, fields) => logs.push({ event, fields }),
  }
  return { resolver: createCredentialResolver(deps), logs, findInstance, loadStored, clock }
}

describe("credential resolver", () => {
  it("banco primeiro: o valor do banco vence o ambiente na mesma chave", async () => {
    const { resolver } = setup({
      stored: { API_KEY: DB_SECRET },
      env: { ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET },
    })
    const resolved = await resolver.resolve(selector)
    expect(resolved.values.API_KEY).toBe(DB_SECRET)
    expect(resolved.sources.API_KEY).toBe("db")
  })

  it("reserva POR CHAVE: o ambiente preenche só o que o banco não tem", async () => {
    const { resolver } = setup({
      stored: { API_KEY: DB_SECRET },
      env: {
        ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET,
        ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET: "env_whsec_000000",
      },
    })
    const resolved = await resolver.resolve(selector)
    expect(resolved.sources).toEqual({ API_KEY: "db", WEBHOOK_SECRET: "env" })
    expect(resolved.values.WEBHOOK_SECRET).toBe("env_whsec_000000")
  })

  it("sem instância ou sem linhas, o comportamento é o do ambiente (idêntico ao atual)", async () => {
    const { resolver } = setup({ instance: false, env: { ABACATE_PAY_API_KEY: ENV_SECRET } })
    const resolved = await resolver.resolve(selector)
    expect(resolved.values.API_KEY).toBe(ENV_SECRET)
    expect(resolved.sources.API_KEY).toBe("env")
    expect(resolved.instanceId).toBeNull()
  })

  it("banco indisponível cai no ambiente em vez de derrubar o pagamento", async () => {
    const { resolver, logs } = setup({ dbFails: true, env: { ABACATE_PAY_API_KEY: ENV_SECRET } })
    const resolved = await resolver.resolve(selector)
    expect(resolved.values.API_KEY).toBe(ENV_SECRET)
    expect(logs.some((l) => l.event === "payment_provider_credentials_db_unavailable")).toBe(true)
  })

  it("credencial gravada e ilegível LANÇA e não cai no ambiente", async () => {
    const other = createCredentialCipher({ currentKeyId: "k1", keys: { k1: "d".repeat(64) } })
    const { resolver } = setup({ stored: { API_KEY: DB_SECRET }, env: { ABACATE_PAY_API_KEY: ENV_SECRET } })
    const broken = createCredentialResolver({
      findInstance: async () => ({ id: CONFIG_ID, externalAccountContext: "x", settings: {} }),
      loadStored: async () => [{ key: "API_KEY", valueCiphertext: other.encrypt(DB_SECRET, "cfg-1:API_KEY") }],
      decrypt: (payload, context) => cipher.decrypt(payload, context),
      env: () => ({ ABACATE_PAY_API_KEY: ENV_SECRET }),
      cache: new CredentialCache(),
      log: () => undefined,
    })
    await expect(broken.resolve(selector)).rejects.toThrow()
    expect(resolver).toBeDefined()
  })

  it("registra a fonte de cada chave sem nunca registrar valores", async () => {
    const { resolver, logs } = setup({
      stored: { API_KEY: DB_SECRET },
      env: { ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET: ENV_SECRET },
    })
    await resolver.resolve(selector)
    const serialized = JSON.stringify(logs)
    expect(serialized).toContain('"API_KEY":"db"')
    expect(serialized).toContain('"WEBHOOK_SECRET":"env"')
    expect(serialized).not.toContain(DB_SECRET)
    expect(serialized).not.toContain(ENV_SECRET)
  })

  it("cache de 30 s: segunda leitura não toca o banco; depois do TTL, relê", async () => {
    const { resolver, findInstance, clock } = setup({ stored: { API_KEY: DB_SECRET } })
    await resolver.resolve(selector)
    await resolver.resolve(selector)
    expect(findInstance).toHaveBeenCalledTimes(1)
    clock.value = 31_000
    await resolver.resolve(selector)
    expect(findInstance).toHaveBeenCalledTimes(2)
  })

  it("resolveSync usa o cache aquecido e cai no ambiente sem ele", async () => {
    const { resolver } = setup({
      stored: { API_KEY: DB_SECRET },
      env: { ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET },
    })
    expect(resolver.resolveSync(selector).values.API_KEY).toBe(ENV_SECRET)
    await resolver.resolve(selector)
    expect(resolver.resolveSync(selector).values.API_KEY).toBe(DB_SECRET)
  })

  it("expõe as configurações da instância (requireSignature)", async () => {
    const { resolver } = setup({ stored: {} })
    expect((await resolver.resolve(selector)).settings.requireSignature).toBe(true)
  })

  it("chaves extras arbitrárias do banco são devolvidas", async () => {
    const { resolver } = setup({ stored: { EXTRA_TOKEN: "extra_value_000000" } })
    expect((await resolver.resolve(selector)).values.EXTRA_TOKEN).toBe("extra_value_000000")
  })

  it("Asaas legacy lê ASAAS_LEGACY_* como reserva", async () => {
    const { resolver } = setup({ instance: false, env: { ASAAS_LEGACY_API_KEY: "aact_legacy_000" } })
    const resolved = await resolver.resolve({
      provider: "ASAAS",
      environment: "PRODUCTION",
      externalAccountContext: "legacy",
    })
    expect(resolved.values.API_KEY).toBe("aact_legacy_000")
  })

  it("controle: cipher amarra o contexto (linha trocada falha)", async () => {
    const swapped = createCredentialResolver({
      findInstance: async () => ({ id: CONFIG_ID, externalAccountContext: "x", settings: {} }),
      loadStored: async () => [{ key: "API_KEY", valueCiphertext: cipher.encrypt(DB_SECRET, "outra:API_KEY") }],
      decrypt: (payload, context) => cipher.decrypt(payload, context),
      env: () => ({}),
      cache: new CredentialCache(),
      log: () => undefined,
    })
    await expect(swapped.resolve(selector)).rejects.toThrow()
  })
})
