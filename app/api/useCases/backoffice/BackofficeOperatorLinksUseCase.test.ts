import { beforeEach, describe, expect, it } from "bun:test"
import type { BackofficeUser, UserFunction } from "@prisma/client"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import type { AuditLogEntry } from "@/app/api/infra/data/repositories/audit/IAuditLogRepository"
import type {
  IBackofficeOperatorLinksRepository,
  OperatorLinkedTeam,
  OperatorTeamMemberRef,
  OperatorTeamScope,
} from "@/app/api/infra/data/repositories/backoffice/OperatorLinksRepository/IBackofficeOperatorLinksRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { BackofficeOperatorLinksUseCase, type OperatorAccountLink } from "./BackofficeOperatorLinksUseCase"

const manager: BackofficeAccess = {
  supabaseId: "sb-manager",
  profileId: "profile-manager",
  backofficeUserId: "bo-manager",
  backofficeEmail: "gestor@corretorstudio.com.br",
  fullAccess: true,
  isOperator: false,
}

const operatorActor: BackofficeAccess = { ...manager, fullAccess: false, isOperator: true }

function buildUser(overrides: Partial<BackofficeUser> = {}): BackofficeUser {
  return {
    id: "user-1",
    profileId: "profile-op",
    email: "op@corretorstudio.com.br",
    fullAccess: false,
    isActive: true,
    isSdr: true,
    isCloser: false,
    ...overrides,
  } as BackofficeUser
}

const TEAMS: Record<string, { name: string; masterId: string }> = {
  "team-a1": { name: "Time A1", masterId: "master-a" },
  "team-a2": { name: "Time A2", masterId: "master-a" },
  "team-b1": { name: "Time B1", masterId: "master-b" },
}

class FakeLinksRepo implements IBackofficeOperatorLinksRepository {
  linked = new Map<string, { memberId: string; functions: UserFunction[] }>()
  private seq = 0

  async findLinkedTeams(): Promise<OperatorLinkedTeam[]> {
    return [...this.linked.entries()].map(([teamId, link]) => ({
      memberId: link.memberId,
      teamId,
      teamName: TEAMS[teamId].name,
      masterId: TEAMS[teamId].masterId,
      masterName: TEAMS[teamId].masterId,
      masterEmail: `${TEAMS[teamId].masterId}@cliente.com`,
    }))
  }

  async findActiveTeams(teamIds: string[]): Promise<OperatorTeamScope[]> {
    return teamIds
      .filter((teamId) => TEAMS[teamId])
      .map((teamId) => ({ teamId, masterId: TEAMS[teamId].masterId }))
  }

  async addTeams(_profileId: string, teamIds: string[], functions: UserFunction[]): Promise<OperatorTeamMemberRef[]> {
    return teamIds.map((teamId) => {
      const memberId = `member-${++this.seq}`
      this.linked.set(teamId, { memberId, functions })
      return { memberId, teamId }
    })
  }

  async removeTeams(_profileId: string, teamIds: string[]): Promise<OperatorTeamMemberRef[]> {
    const removed: OperatorTeamMemberRef[] = []
    for (const teamId of teamIds) {
      const link = this.linked.get(teamId)
      if (!link) continue
      removed.push({ memberId: link.memberId, teamId })
      this.linked.delete(teamId)
    }
    return removed
  }

  async updateFunctions(_profileId: string, functions: UserFunction[]): Promise<void> {
    for (const link of this.linked.values()) link.functions = functions
  }
}

function buildUseCase(user: BackofficeUser | null) {
  const linksRepo = new FakeLinksRepo()
  const audits: AuditLogEntry[] = []
  const userRepo = { findById: async () => user } as unknown as IBackofficeUserRepository
  const useCase = new BackofficeOperatorLinksUseCase(userRepo, linksRepo, {
    logAudit: async (entry) => {
      audits.push(entry)
    },
  })
  return { useCase, linksRepo, audits }
}

describe("BackofficeOperatorLinksUseCase.syncLinks", () => {
  let ctx: ReturnType<typeof buildUseCase>

  beforeEach(() => {
    ctx = buildUseCase(buildUser())
  })

  it("só Manager do backoffice vincula contas", async () => {
    const output = await ctx.useCase.syncLinks("user-1", [], operatorActor)

    expect(output.isValid).toBe(false)
    expect(ctx.linksRepo.linked.size).toBe(0)
  })

  it("não vincula um usuário que é Manager", async () => {
    const { useCase } = buildUseCase(buildUser({ fullAccess: true }))

    const output = await useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-a1"] }], manager)

    expect(output.isValid).toBe(false)
  })

  it("recusa time que não pertence à conta informada", async () => {
    const output = await ctx.useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-b1"] }], manager)

    expect(output.isValid).toBe(false)
    expect(ctx.linksRepo.linked.size).toBe(0)
  })

  it("recusa time inexistente", async () => {
    const output = await ctx.useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-zzz"] }], manager)

    expect(output.isValid).toBe(false)
  })

  it("exige SDR ou Closer para vincular a times", async () => {
    const { useCase, linksRepo } = buildUseCase(buildUser({ isSdr: false, isCloser: false }))

    const output = await useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-a1"] }], manager)

    expect(output.isValid).toBe(false)
    expect(linksRepo.linked.size).toBe(0)
  })

  it("vincula várias contas com as funções do cadastro e audita cada time", async () => {
    const { useCase, linksRepo, audits } = buildUseCase(buildUser({ isSdr: true, isCloser: true }))

    const output = await useCase.syncLinks(
      "user-1",
      [
        { masterId: "master-a", teamIds: ["team-a1", "team-a2"] },
        { masterId: "master-b", teamIds: ["team-b1"] },
      ],
      manager
    )

    expect(output.isValid).toBe(true)
    expect([...linksRepo.linked.keys()].sort()).toEqual(["team-a1", "team-a2", "team-b1"])
    expect(linksRepo.linked.get("team-a1")?.functions).toEqual(["SDR", "CLOSER"])
    expect((output.result as OperatorAccountLink[]).map((account) => account.masterId).sort()).toEqual([
      "master-a",
      "master-b",
    ])
    expect(audits).toHaveLength(3)
    expect(audits.every((entry) => entry.action === "CREATE" && entry.entityType === "TEAM_MEMBER")).toBe(true)
    expect(audits[0].metadata).toMatchObject({ actorKind: "backoffice_user", operatorProfileId: "profile-op" })
  })

  it("remove o que saiu da lista e mantém o que continua", async () => {
    await ctx.useCase.syncLinks(
      "user-1",
      [{ masterId: "master-a", teamIds: ["team-a1", "team-a2"] }],
      manager
    )
    ctx.audits.length = 0

    const output = await ctx.useCase.syncLinks(
      "user-1",
      [{ masterId: "master-a", teamIds: ["team-a2"] }],
      manager
    )

    expect(output.isValid).toBe(true)
    expect([...ctx.linksRepo.linked.keys()]).toEqual(["team-a2"])
    expect(ctx.audits).toHaveLength(1)
    expect(ctx.audits[0]).toMatchObject({ action: "DELETE", before: { teamId: "team-a1" } })
  })

  it("lista vazia remove todos os vínculos", async () => {
    await ctx.useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-a1"] }], manager)

    const output = await ctx.useCase.syncLinks("user-1", [], manager)

    expect(output.isValid).toBe(true)
    expect(ctx.linksRepo.linked.size).toBe(0)
  })

  it("rejeita payload que não é lista", async () => {
    const output = await ctx.useCase.syncLinks("user-1", "x", manager)

    expect(output.isValid).toBe(false)
  })
})

describe("BackofficeOperatorLinksUseCase.syncAfterUserChange", () => {
  it("atualiza as funções dos times quando SDR/Closer mudam", async () => {
    const { useCase, linksRepo } = buildUseCase(buildUser({ isSdr: true, isCloser: false }))
    await useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-a1"] }], manager)

    await useCase.syncAfterUserChange({ profileId: "profile-op", fullAccess: false, isSdr: false, isCloser: true })

    expect(linksRepo.linked.get("team-a1")?.functions).toEqual(["CLOSER"])
  })

  it("remove os vínculos quando o usuário vira Manager", async () => {
    const { useCase, linksRepo } = buildUseCase(buildUser())
    await useCase.syncLinks("user-1", [{ masterId: "master-a", teamIds: ["team-a1", "team-b1"] }], manager)

    await useCase.syncAfterUserChange({ profileId: "profile-op", fullAccess: true, isSdr: true, isCloser: true })

    expect(linksRepo.linked.size).toBe(0)
  })
})
