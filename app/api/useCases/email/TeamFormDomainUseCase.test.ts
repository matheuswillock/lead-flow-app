import { describe, expect, it, mock } from "bun:test"
import type {
  ITeamFormDomainRepository,
  SaveTeamFormDomainCheckInput,
  TeamFormDomainRecord,
} from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"

// Mesmo motivo do stub em ReconcileTeamFormDomainStatusUseCase.test.ts: o
// UseCase importa `@/lib/cache/invalidation` (`server-only`); dependências
// reais entram por DI, o stub só existe para o módulo carregar no bun:test.
mock.module("server-only", () => ({}))

const { TeamFormDomainUseCase } = await import("./TeamFormDomainUseCase")

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

function makeRepository(domain: TeamFormDomainRecord) {
  const saved: SavedCheck[] = []
  const repository = {
    async findByTeamId() {
      return domain
    },
    async saveCheckResult(id: string, input: SaveTeamFormDomainCheckInput) {
      saved.push({ id, input })
      return { ...domain, status: input.status, verifiedAt: input.verifiedAt ?? domain.verifiedAt }
    },
  } as unknown as ITeamFormDomainRepository
  return { repository, saved }
}

describe("TeamFormDomainUseCase.verifyFormDomain", () => {
  /**
   * Regressão do achado P1 do codex (PR #1204): o botão "Verificar agora"
   * não pode rebaixar um domínio `verified` porque a Vercel respondeu com
   * erro transitório (429/500/timeout) — isso derrubaria os formulários
   * públicos do time até a próxima tentativa manual ou o próximo tick do cron.
   */
  it("preserva domínio verificado quando a consulta à Vercel falha transitoriamente", async () => {
    const domain = makeDomain({ status: "verified" })
    const { repository, saved } = makeRepository(domain)
    const invalidated: string[] = []
    const useCase = new TeamFormDomainUseCase({
      repository,
      vercelGateway: {
        isConfigured: () => true,
        async getProjectDomain() {
          return { ok: false, status: 500, errorMessage: "internal error" }
        },
        async getDomainConfig() {
          throw new Error("não usado — getProjectDomain já falhou")
        },
        async addProjectDomain() {
          throw new Error("não usado")
        },
        async removeProjectDomain() {
          throw new Error("não usado")
        },
      } as unknown as IVercelDomainsGateway,
      invalidateCache: ({ hostname }) => invalidated.push(hostname),
    })

    const output = await useCase.verifyFormDomain({
      teamId: "team-1",
    } as unknown as Parameters<typeof useCase.verifyFormDomain>[0])

    expect(output.isValid).toBe(true)
    expect(saved).toHaveLength(1)
    expect(saved[0]?.input.status).toBe("verified")
    expect(saved[0]?.input.verifiedAt).toBeUndefined()
    // Falha de transporte não invalida cache — nada mudou de fato.
    expect(invalidated).toEqual([])
  })
})
