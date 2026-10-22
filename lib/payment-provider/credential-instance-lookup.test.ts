import { describe, expect, it } from "bun:test"
import type { ResolverInstance } from "./credential-resolver"
import { createCredentialInstanceLookup } from "./credential-instance-lookup"
import type { ProviderInstanceRecord } from "./instance"

function record(id: string, context: string): ProviderInstanceRecord {
  return {
    id,
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    enabled: true,
    isDefault: false,
    externalAccountContext: context,
    rolloutState: "ACTIVE",
    killSwitch: false,
    revision: 1,
    healthStatus: "HEALTHY",
    displayName: id,
    logoUrl: null,
    logoAltText: null,
    settings: { cardEnabled: false },
    lastHealthCheckAt: null,
    lastErrorCode: null,
  }
}

const A = record("a", "ctx-a")
const B = record("b", "ctx-b")
const selector = { provider: "ABACATE_PAY", environment: "PRODUCTION" } as const

function lookup() {
  return createCredentialInstanceLookup({
    findPrimary: async () => A,
    findByScope: async (_p, _e, context) => ({ "ctx-a": A, "ctx-b": B })[context] ?? null,
  })
}

describe("credential instance lookup", () => {
  it("sem contexto devolve a principal marcada como principal", async () => {
    const found = (await lookup()(selector)) as ResolverInstance
    expect(found.id).toBe("a")
    expect(found.isPrimary).toBe(true)
  })

  it("com contexto devolve a instância pedida, não a principal", async () => {
    const found = (await lookup()({ ...selector, externalAccountContext: "ctx-b" })) as ResolverInstance
    expect(found.id).toBe("b")
    expect(found.externalAccountContext).toBe("ctx-b")
    expect(found.isPrimary).toBe(false)
  })

  it("com contexto da própria principal marca isPrimary", async () => {
    const found = (await lookup()({ ...selector, externalAccountContext: "ctx-a" })) as ResolverInstance
    expect(found.isPrimary).toBe(true)
  })

  it("contexto sem linha devolve null (bootstrap pelo ambiente)", async () => {
    expect(await lookup()({ ...selector, externalAccountContext: "nenhum" })).toBeNull()
  })
})
