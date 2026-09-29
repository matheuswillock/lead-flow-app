import { describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { ITeamStudioDomainRepository, TeamStudioDomainRecord } from "@/app/api/infra/data/repositories/teamStudioDomain/ITeamStudioDomainRepository"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import { TeamStudioDomainUseCase } from "./TeamStudioDomainUseCase"

const teamAccess = { teamId: "team-1", isMaster: true, teamMember: { role: "manager" } } as TeamAccess

function makeDomain(): TeamStudioDomainRecord {
  const now = new Date("2026-09-29T12:00:00.000Z")
  return {
    id: "studio-1",
    teamId: "team-1",
    hostname: "studio.acme.com",
    status: "pending",
    vercelDomainId: "studio.acme.com",
    verifiedAt: null,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function makeRepository(domain: TeamStudioDomainRecord | null = null): ITeamStudioDomainRepository {
  return {
    findByTeamId: mock(async () => domain),
    findByHostname: mock(async () => null),
    create: mock(async () => makeDomain()),
    saveCheckResult: mock(async () => makeDomain()),
    deleteById: mock(async () => undefined),
  }
}

function makeVercelGateway(): IVercelDomainsGateway {
  return {
    isConfigured: () => true,
    addProjectDomain: mock(async () => ({
      ok: true as const,
      data: { name: "studio.acme.com", apexName: "acme.com", verified: false, verification: [] },
    })),
    getProjectDomain: mock(async () => ({
      ok: true as const,
      data: { name: "studio.acme.com", apexName: "acme.com", verified: false, verification: [] },
    })),
    removeProjectDomain: mock(async () => ({ ok: true as const, data: { removed: true } })),
    getDomainConfig: mock(async () => ({ ok: true as const, data: { misconfigured: true } })),
  }
}

describe("TeamStudioDomainUseCase", () => {
  it("cria o domínio studio assim que o domínio de envio é conectado, antes do DNS ser verificado", async () => {
    const repository = makeRepository()
    const vercelGateway = makeVercelGateway()
    const useCase = new TeamStudioDomainUseCase({ repository, vercelGateway })

    const result = await useCase.getForEmailDomain(teamAccess, {
      name: "mail.acme.com",
      status: "pending",
    })

    expect(result.isValid).toBe(true)
    expect(vercelGateway.addProjectDomain).toHaveBeenCalledWith("studio.mail.acme.com")
    expect(repository.create).toHaveBeenCalledWith({
      teamId: "team-1",
      hostname: "studio.mail.acme.com",
      vercelDomainId: "studio.acme.com",
    })
  })
})
