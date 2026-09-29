import { describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { ITeamStudioDomainRepository, TeamStudioDomainRecord } from "@/app/api/infra/data/repositories/teamStudioDomain/ITeamStudioDomainRepository"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import { TeamStudioDomainUseCase } from "./TeamStudioDomainUseCase"

const teamAccess = { teamId: "team-1", isMaster: true, teamMember: { role: "manager" } } as TeamAccess

function makeDomain(hostname = "studio.acme.com"): TeamStudioDomainRecord {
  const now = new Date("2026-09-29T12:00:00.000Z")
  return {
    id: "studio-1",
    teamId: "team-1",
    hostname,
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

  it("reutiliza o domínio quando duas inicializações acontecem ao mesmo tempo", async () => {
    let storedDomain: TeamStudioDomainRecord | null = null
    let initialFinds = 0
    let releaseInitialFinds!: () => void
    const initialFindsReleased = new Promise<void>((resolve) => {
      releaseInitialFinds = resolve
    })
    let createCalls = 0
    const repository = {
      ...makeRepository(),
      findByTeamId: mock(async () => {
        if (!storedDomain) {
          initialFinds += 1
          if (initialFinds === 2) releaseInitialFinds()
          await initialFindsReleased
        }
        return storedDomain
      }),
      create: mock(async () => {
        createCalls += 1
        if (createCalls === 2) throw new Error("team_studio_domain_team_id_key")
        storedDomain = makeDomain("studio.mail.acme.com")
        return storedDomain
      }),
    }
    let registrationCalls = 0
    const vercelGateway = {
      ...makeVercelGateway(),
      addProjectDomain: mock(async () => {
        registrationCalls += 1
        return registrationCalls === 1
          ? {
              ok: true as const,
              data: { name: "studio.mail.acme.com", apexName: "acme.com", verified: false, verification: [] },
            }
          : { ok: false as const, status: 409, errorMessage: "Domínio já registrado" }
      }),
      getProjectDomain: mock(async () => ({
        ok: true as const,
        data: { name: "studio.mail.acme.com", apexName: "acme.com", verified: false, verification: [] },
      })),
    }
    const useCase = new TeamStudioDomainUseCase({ repository, vercelGateway })

    const results = await Promise.all([
      useCase.getForEmailDomain(teamAccess, { name: "mail.acme.com", status: "pending" }),
      useCase.getForEmailDomain(teamAccess, { name: "mail.acme.com", status: "pending" }),
    ])

    expect(results.every((result) => result.isValid)).toBe(true)
    expect(repository.create).toHaveBeenCalledTimes(2)
    expect(vercelGateway.getProjectDomain).toHaveBeenCalledWith("studio.mail.acme.com")
  })
})
