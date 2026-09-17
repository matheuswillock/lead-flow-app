import { describe, expect, it, mock } from "bun:test"
import type {
  ITeamFormDomainRepository,
  SaveTeamFormDomainCheckInput,
  TeamFormDomainRecord,
} from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import type {
  IVercelDomainsGateway,
  VercelDomainConfig,
  VercelDomainsGatewayResult,
  VercelProjectDomain,
} from "@/app/api/services/vercelDomains/IVercelDomainsGateway"

// O UseCase importa `@/lib/cache/invalidation`, que é `server-only`. As
// dependências reais entram por DI (repository/gateway/invalidateCache
// falsos); o stub existe só para o módulo carregar fora do runtime do Next —
// por isso o import do UseCase é dinâmico, depois do mock.
mock.module("server-only", () => ({}))

const { ReconcileTeamFormDomainStatusUseCase } = await import(
  "./ReconcileTeamFormDomainStatusUseCase"
)

const HOSTNAME = "forms.time-a.com.br"

function makeDomain(overrides: Partial<TeamFormDomainRecord> = {}): TeamFormDomainRecord {
  return {
    id: "domain-1",
    teamId: "team-1",
    hostname: HOSTNAME,
    status: "verified",
    vercelDomainId: HOSTNAME,
    verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastCheckedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

type SavedCheck = { id: string; input: SaveTeamFormDomainCheckInput }

function makeRepository(domains: TeamFormDomainRecord[]) {
  const saved: SavedCheck[] = []
  const repository = {
    async listForReconciliation() {
      return domains
    },
    async saveCheckResult(id: string, input: SaveTeamFormDomainCheckInput) {
      saved.push({ id, input })
      return makeDomain({ id, status: input.status, verifiedAt: input.verifiedAt ?? null })
    },
  } as unknown as ITeamFormDomainRepository
  return { repository, saved }
}

/** Gateway que responde o que o cenário pedir para `getProjectDomain`. */
function makeGateway(projectDomain: VercelDomainsGatewayResult<VercelProjectDomain>) {
  return {
    isConfigured: () => true,
    async getProjectDomain() {
      return projectDomain
    },
    async getDomainConfig(): Promise<VercelDomainsGatewayResult<VercelDomainConfig>> {
      return { ok: true, data: { misconfigured: false } }
    },
    async addProjectDomain() {
      throw new Error("não usado")
    },
    async removeProjectDomain() {
      throw new Error("não usado")
    },
  } as unknown as IVercelDomainsGateway
}

describe("ReconcileTeamFormDomainStatusUseCase", () => {
  /**
   * Regressão do achado P1 do codex: domínio `verified` cujo registro sumiu da
   * infraestrutura (404) precisa ser REBAIXADO. Antes, ele nem entrava na
   * varredura e as campanhas seguiam apontando para um host morto.
   */
  it("rebaixa domínio verificado que sumiu da infraestrutura", async () => {
    const { repository, saved } = makeRepository([makeDomain({ status: "verified" })])
    const invalidated: string[] = []
    const useCase = new ReconcileTeamFormDomainStatusUseCase({
      repository,
      vercelGateway: makeGateway({ ok: false, status: 404, errorMessage: "not found" }),
      invalidateCache: ({ hostname }) => invalidated.push(hostname),
    })

    const output = await useCase.execute()

    expect(saved).toHaveLength(1)
    expect(saved[0]?.input.status).toBe("failed")
    // Rebaixou: verifiedAt tem que ser limpo, senão a UI mostra "verificado em".
    expect(saved[0]?.input.verifiedAt).toBeNull()
    expect(invalidated).toEqual([HOSTNAME])
    expect((output.result as { downgraded: number }).downgraded).toBe(1)
  })

  it("mantém verificado o domínio que continua no ar e não conta rebaixamento", async () => {
    const { repository, saved } = makeRepository([makeDomain({ status: "verified" })])
    const invalidated: string[] = []
    const useCase = new ReconcileTeamFormDomainStatusUseCase({
      repository,
      vercelGateway: makeGateway({ ok: true, data: { name: HOSTNAME, verified: true } }),
      invalidateCache: ({ hostname }) => invalidated.push(hostname),
    })

    const output = await useCase.execute()

    expect(saved[0]?.input.status).toBe("verified")
    // Status inalterado não invalida cache — evita revalidação desnecessária.
    expect(invalidated).toEqual([])
    expect((output.result as { downgraded: number }).downgraded).toBe(0)
    expect((output.result as { verified: number }).verified).toBe(1)
  })

  it("promove domínio pendente que passou a resolver", async () => {
    const { repository, saved } = makeRepository([
      makeDomain({ status: "pending", verifiedAt: null }),
    ])
    const invalidated: string[] = []
    const useCase = new ReconcileTeamFormDomainStatusUseCase({
      repository,
      vercelGateway: makeGateway({ ok: true, data: { name: HOSTNAME, verified: true } }),
      invalidateCache: ({ hostname }) => invalidated.push(hostname),
    })

    const output = await useCase.execute()

    expect(saved[0]?.input.status).toBe("verified")
    expect(invalidated).toEqual([HOSTNAME])
    expect((output.result as { downgraded: number }).downgraded).toBe(0)
  })
})
