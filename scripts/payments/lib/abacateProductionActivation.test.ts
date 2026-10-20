import { describe, expect, it } from "bun:test"
import {
  ABACATE_PRODUCTION_ACCOUNT_CONTEXT,
  parseActivationArgs,
  runAbacateProductionActivation,
  type ActivationDependencies,
} from "./abacateProductionActivation"
import {
  applyProviderRoutingConfigPatch,
  type ProviderRoutingConfigPatch,
  type ProviderRoutingConfigRecord,
} from "@/lib/payment-provider/routing-config"

function baseRecord(overrides: Partial<ProviderRoutingConfigRecord> = {}): ProviderRoutingConfigRecord {
  return {
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    enabled: false,
    isDefault: false,
    externalAccountContext: ABACATE_PRODUCTION_ACCOUNT_CONTEXT,
    rolloutState: "DISABLED",
    killSwitch: false,
    revision: 4,
    healthStatus: "HEALTHY",
    ...overrides,
  }
}

function fakeDependencies(initial: ProviderRoutingConfigRecord | null) {
  let current = initial
  const patches: ProviderRoutingConfigPatch[] = []
  const dependencies: ActivationDependencies = {
    getConfig: async () => current,
    applyPatch: async (patch) => {
      patches.push(patch)
      current = applyProviderRoutingConfigPatch(current as ProviderRoutingConfigRecord, patch)
      return current
    },
  }
  return { dependencies, patches, getCurrent: () => current }
}

describe("runAbacateProductionActivation", () => {
  it("em dry-run planeja os três passos sem aplicar nenhum", async () => {
    const { dependencies, patches } = fakeDependencies(baseRecord())

    const result = await runAbacateProductionActivation({ apply: false, expectedRevision: 4 }, dependencies)

    expect(result.ok).toBe(true)
    expect(result.applied).toBe(false)
    expect(result.plannedSteps.map((step) => step.rolloutState)).toEqual([
      "SANDBOX_VALIDATED",
      "APPROVED",
      "ACTIVE",
    ])
    expect(result.plannedSteps.map((step) => step.expectedRevision)).toEqual([4, 5, 6])
    expect(patches).toHaveLength(0)
  })

  it("com apply avança passo a passo e termina ACTIVE, habilitado e default", async () => {
    const { dependencies, patches, getCurrent } = fakeDependencies(baseRecord())

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 4 }, dependencies)

    expect(result.ok).toBe(true)
    expect(result.applied).toBe(true)
    expect(patches.map((patch) => patch.rolloutState)).toEqual([
      "SANDBOX_VALIDATED",
      "APPROVED",
      "ACTIVE",
    ])
    expect(patches.map((patch) => patch.expectedRevision)).toEqual([4, 5, 6])
    expect(patches.every((patch) => patch.externalAccountContext === "abacate-production")).toBe(true)
    expect(getCurrent()).toMatchObject({
      rolloutState: "ACTIVE",
      enabled: true,
      isDefault: true,
      healthStatus: "HEALTHY",
      revision: 7,
    })
  })

  it("retoma de um passo intermediário", async () => {
    const { dependencies, patches } = fakeDependencies(baseRecord({ rolloutState: "APPROVED", revision: 6 }))

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 6 }, dependencies)

    expect(result.ok).toBe(true)
    expect(patches.map((patch) => patch.rolloutState)).toEqual(["ACTIVE"])
  })

  it("recusa quando a revisão esperada está desatualizada, sem aplicar", async () => {
    const { dependencies, patches } = fakeDependencies(baseRecord())

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 3 }, dependencies)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("revisão")
    expect(patches).toHaveLength(0)
  })

  it("recusa quando o health não é HEALTHY", async () => {
    for (const healthStatus of ["UNKNOWN", "UNHEALTHY"] as const) {
      const { dependencies, patches } = fakeDependencies(baseRecord({ healthStatus }))

      const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 4 }, dependencies)

      expect(result.ok).toBe(false)
      expect(result.error).toContain("HEALTHY")
      expect(patches).toHaveLength(0)
    }
  })

  it("recusa com kill switch ligado", async () => {
    const { dependencies, patches } = fakeDependencies(baseRecord({ killSwitch: true }))

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 4 }, dependencies)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("kill switch")
    expect(patches).toHaveLength(0)
  })

  it("recusa contexto de conta diferente, pois a troca zeraria a saúde", async () => {
    const { dependencies, patches } = fakeDependencies(baseRecord({ externalAccountContext: "outro" }))

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 4 }, dependencies)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("contexto")
    expect(patches).toHaveLength(0)
  })

  it("recusa linha inexistente", async () => {
    const { dependencies } = fakeDependencies(null)

    const result = await runAbacateProductionActivation({ apply: false, expectedRevision: 1 }, dependencies)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("não encontrada")
  })

  it("não faz nada quando já está ativo, habilitado e default", async () => {
    const { dependencies, patches } = fakeDependencies(
      baseRecord({ rolloutState: "ACTIVE", enabled: true, isDefault: true, revision: 7 }),
    )

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 7 }, dependencies)

    expect(result.ok).toBe(true)
    expect(result.plannedSteps).toHaveLength(0)
    expect(patches).toHaveLength(0)
  })

  it("reporta falha de um passo e interrompe os seguintes", async () => {
    const { dependencies } = fakeDependencies(baseRecord())
    let calls = 0
    const failing: ActivationDependencies = {
      ...dependencies,
      applyPatch: async (patch) => {
        calls += 1
        if (calls === 2) throw new Error("A revisão da configuração está desatualizada")
        return dependencies.applyPatch(patch)
      },
    }

    const result = await runAbacateProductionActivation({ apply: true, expectedRevision: 4 }, failing)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("desatualizada")
    expect(calls).toBe(2)
  })
})

describe("parseActivationArgs", () => {
  it("usa dry-run por padrão", () => {
    expect(parseActivationArgs(["--expected-revision=4"])).toEqual({ apply: false, expectedRevision: 4 })
  })

  it("aceita --apply explícito", () => {
    expect(parseActivationArgs(["--apply", "--expected-revision=4"])).toEqual({
      apply: true,
      expectedRevision: 4,
    })
  })

  it("exige --expected-revision inteiro", () => {
    expect(() => parseActivationArgs([])).toThrow("--expected-revision")
    expect(() => parseActivationArgs(["--expected-revision=abc"])).toThrow("--expected-revision")
  })
})
