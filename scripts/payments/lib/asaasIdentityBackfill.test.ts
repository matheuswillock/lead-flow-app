import { describe, expect, it, mock } from "bun:test"
import {
  buildIdentityCandidates,
  parseBackfillArgs,
  runAsaasIdentityBackfill,
  type BackfillDependencies,
} from "./asaasIdentityBackfill"
import type { AsaasProfileIdentityRow } from "@/app/api/infra/data/repositories/paymentCharge/AsaasIdentityBackfillRepository"

const row = (overrides: Partial<AsaasProfileIdentityRow> = {}): AsaasProfileIdentityRow => ({
  profileId: "profile-1",
  customerId: "cus_1",
  customerAccount: "primary",
  profileSubscriptionAsaasId: null,
  profileSubscriptionAccount: "primary",
  subscriptionRowId: "sub-row-1",
  subscriptionRowAsaasId: "sub_1",
  subscriptionRowAccount: "legacy",
  ...overrides,
})

function makeDeps(rows: AsaasProfileIdentityRow[], bound: Set<string> = new Set()) {
  const bind = mock(async (_binding: unknown) => undefined)
  const deps: BackfillDependencies = {
    listProfiles: async ({ afterId }) => (afterId ? [] : rows),
    isBound: async (candidate) => bound.has(`${candidate.account}:${candidate.externalId}`),
    bind,
    environment: "PRODUCTION",
  }
  return { deps, bind }
}

describe("buildIdentityCandidates", () => {
  it("gera cliente e assinatura por conta, e ignora ids sintéticos de adesão", () => {
    const candidates = buildIdentityCandidates(
      row({ profileSubscriptionAsaasId: "adhesion-9", subscriptionRowAsaasId: "sub_1" }),
    )
    expect(candidates.map((c) => [c.kind, c.account, c.externalId, c.ownerType, c.ownerId])).toEqual([
      ["CUSTOMER", "primary", "cus_1", "PROFILE", "profile-1"],
      ["SUBSCRIPTION", "legacy", "sub_1", "PROFILE_SUBSCRIPTION", "sub-row-1"],
    ])
  })

  it("assinatura só no Profile usa o próprio perfil como dono; duplicata entre as duas fontes vira uma", () => {
    const only = buildIdentityCandidates(row({ customerId: null, subscriptionRowAsaasId: null, subscriptionRowId: null, profileSubscriptionAsaasId: "sub_p" }))
    expect(only).toHaveLength(1)
    expect(only[0]).toMatchObject({ ownerType: "PROFILE", ownerId: "profile-1", externalId: "sub_p" })

    const dup = buildIdentityCandidates(row({ customerId: null, profileSubscriptionAsaasId: "sub_1", profileSubscriptionAccount: "legacy" }))
    expect(dup).toHaveLength(1)
  })
})

describe("runAsaasIdentityBackfill", () => {
  it("dry-run (padrão) conta e calcula checksum sem gravar", async () => {
    const { deps, bind } = makeDeps([row()])

    const result = await runAsaasIdentityBackfill({ apply: false, batchSize: 100 }, deps)

    expect(result).toMatchObject({ mode: "dry-run", total: 2, toCreate: 2, alreadyBound: 0, applied: 0 })
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(bind).not.toHaveBeenCalled()
  })

  it("--apply grava só o que falta e é idempotente", async () => {
    const bound = new Set(["primary:cus_1"])
    const { deps, bind } = makeDeps([row()], bound)

    const result = await runAsaasIdentityBackfill({ apply: true, batchSize: 100 }, deps)

    expect(result).toMatchObject({ mode: "apply", total: 2, toCreate: 1, alreadyBound: 1, applied: 1 })
    expect(bind).toHaveBeenCalledTimes(1)
    expect(bind.mock.calls[0][0]).toMatchObject({
      provider: "ASAAS",
      route: "LEGACY_ASAAS",
      identityType: "SUBSCRIPTION",
      externalAccountContext: "legacy",
      externalId: "sub_1",
    })
  })

  it("o checksum é o mesmo no dry-run e no apply para os mesmos dados", async () => {
    const dry = await runAsaasIdentityBackfill({ apply: false, batchSize: 100 }, makeDeps([row()]).deps)
    const applied = await runAsaasIdentityBackfill({ apply: true, batchSize: 100 }, makeDeps([row()]).deps)
    expect(applied.checksum).toBe(dry.checksum)
  })

  it("conflito de vínculo é contado e não derruba o lote", async () => {
    const { deps } = makeDeps([row()])
    const failing: BackfillDependencies = {
      ...deps,
      bind: async () => {
        throw new Error("Binding de identidade externa é imutável: ownerId")
      },
    }

    const result = await runAsaasIdentityBackfill({ apply: true, batchSize: 100 }, failing)

    expect(result).toMatchObject({ applied: 0, conflicts: 2 })
  })
})

describe("parseBackfillArgs", () => {
  it("dry-run por padrão e --apply explícito", () => {
    expect(parseBackfillArgs([])).toEqual({ apply: false, batchSize: 200 })
    expect(parseBackfillArgs(["--apply", "--batch-size=50"])).toEqual({ apply: true, batchSize: 50 })
  })
  it("rejeita lote inválido", () => {
    expect(() => parseBackfillArgs(["--batch-size=0"])).toThrow()
  })
})
