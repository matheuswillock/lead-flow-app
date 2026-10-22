import { describe, expect, it, mock } from "bun:test"
import { CREDENTIAL_STALE_MAX_AGE_MS, CredentialCache } from "./credential-cache"
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
  primary?: boolean
  dbFails?: boolean
  now?: { value: number }
}) {
  const clock = options.now ?? { value: 0 }
  const logs: Array<{ event: string; fields: Record<string, unknown> }> = []
  const findInstance = mock(async () => {
    if (options.dbFails) throw new Error("connection refused")
    return options.instance === false
      ? null
      : { id: CONFIG_ID, externalAccountContext: "abacate-production", settings: { requireSignature: true }, isPrimary: options.primary !== false }
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

  it("erro ao ler o banco SEM cache lança e NUNCA cai no ambiente (falha fechada)", async () => {
    const { resolver, logs } = setup({ dbFails: true, env: { ABACATE_PAY_API_KEY: ENV_SECRET } })
    await expect(resolver.resolve(selector)).rejects.toThrow("Não foi possível ler")
    const event = logs.find((l) => l.event === "payment_provider_credentials_db_unavailable")
    expect(event?.fields.servedFrom).toBe("none")
    expect(JSON.stringify(logs)).not.toContain(ENV_SECRET)
  })

  it("erro ao ler o banco COM cache stale mantém requireSignature e os segredos do banco", async () => {
    const clock = { value: 0 }
    const healthy = setup({
      stored: { API_KEY: DB_SECRET },
      env: { ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET },
      now: clock,
    })
    await healthy.resolver.resolve(selector)
    clock.value = 60_000
    healthy.findInstance.mockImplementation(async () => {
      throw new Error("connection refused")
    })
    const resolved = await healthy.resolver.resolve(selector)
    expect(resolved.settings.requireSignature).toBe(true)
    expect(resolved.values.API_KEY).toBe(DB_SECRET)
    expect(resolved.sources.API_KEY).toBe("db")
    expect(healthy.logs.at(-1)?.fields.servedFrom).toBe("stale_cache")
  })

  it("chave ausente no banco usa o ambiente (bootstrap); schema não aplicado também", async () => {
    const { resolver } = setup({ stored: {}, env: { ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET } })
    expect((await resolver.resolve(selector)).sources.API_KEY).toBe("env")
    const missingTable = createCredentialResolver({
      findInstance: async () => {
        throw Object.assign(new Error("relation does not exist"), { code: "P2021" })
      },
      loadStored: async () => [],
      decrypt: () => "",
      env: () => ({ ABACATE_PAY_API_KEY: ENV_SECRET }),
      cache: new CredentialCache(),
      log: () => undefined,
    })
    expect((await missingTable.resolve(selector)).values.API_KEY).toBe(ENV_SECRET)
  })

  it("credencial gravada e ilegível LANÇA e não cai no ambiente", async () => {
    const other = createCredentialCipher({ currentKeyId: "k1", keys: { k1: "d".repeat(64) } })
    const { resolver } = setup({ stored: { API_KEY: DB_SECRET }, env: { ABACATE_PAY_API_KEY: ENV_SECRET } })
    const broken = createCredentialResolver({
      findInstance: async () => ({ id: CONFIG_ID, externalAccountContext: "x", settings: {}, isPrimary: true }),
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

  it("instância NÃO principal do Abacate não recebe a reserva de ambiente (fica sem credencial)", async () => {
    const { resolver } = setup({
      primary: false,
      stored: { WEBHOOK_SECRET: "db_whsec_000000" },
      env: { ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET, ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET: ENV_SECRET },
    })
    const resolved = await resolver.resolve({ ...selector, externalAccountContext: "abacate-b" })
    expect(resolved.values.API_KEY).toBeUndefined()
    expect(resolved.values.WEBHOOK_SECRET).toBe("db_whsec_000000")
    expect(resolved.sources).toEqual({ WEBHOOK_SECRET: "db" })
  })

  it("instância principal do Abacate continua recebendo a reserva de ambiente", async () => {
    const { resolver } = setup({ primary: true, env: { ABACATE_PAY_PRODUCTION_API_KEY: ENV_SECRET } })
    const resolved = await resolver.resolve({ ...selector, externalAccountContext: "abacate-a" })
    expect(resolved.values.API_KEY).toBe(ENV_SECRET)
  })

  it("Asaas legacy (ambiente por contexto de conta) mantém a reserva mesmo sem ser a principal", async () => {
    const { resolver } = setup({ primary: false, env: { ASAAS_LEGACY_API_KEY: "aact_legacy_000" } })
    const resolved = await resolver.resolve({
      provider: "ASAAS",
      environment: "PRODUCTION",
      externalAccountContext: "legacy",
    })
    expect(resolved.values.API_KEY).toBe("aact_legacy_000")
  })

  it("stale tem idade máxima de 10 min: dentro serve, depois lança (falha fechada)", async () => {
    const clock = { value: 0 }
    const ctx = setup({ stored: { API_KEY: DB_SECRET }, now: clock })
    await ctx.resolver.resolve(selector)
    ctx.findInstance.mockImplementation(async () => {
      throw new Error("connection refused")
    })
    clock.value = CREDENTIAL_STALE_MAX_AGE_MS
    expect((await ctx.resolver.resolve(selector)).values.API_KEY).toBe(DB_SECRET)
    clock.value = CREDENTIAL_STALE_MAX_AGE_MS + 1
    await expect(ctx.resolver.resolve(selector)).rejects.toThrow("Não foi possível ler")
    expect(ctx.logs.at(-1)?.fields.servedFrom).toBe("none")
  })

  it("controle: cipher amarra o contexto (linha trocada falha)", async () => {
    const swapped = createCredentialResolver({
      findInstance: async () => ({ id: CONFIG_ID, externalAccountContext: "x", settings: {}, isPrimary: true }),
      loadStored: async () => [{ key: "API_KEY", valueCiphertext: cipher.encrypt(DB_SECRET, "outra:API_KEY") }],
      decrypt: (payload, context) => cipher.decrypt(payload, context),
      env: () => ({}),
      cache: new CredentialCache(),
      log: () => undefined,
    })
    await expect(swapped.resolve(selector)).rejects.toThrow()
  })
})
