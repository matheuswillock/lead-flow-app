import { describe, expect, it, mock } from "bun:test"
import type { AuditLogEntry } from "@/app/api/infra/data/repositories/audit/IAuditLogRepository"
import type {
  IBackofficeSupportRepository,
  SupportAccountSearchItem,
  SupportTeamDetails,
} from "@/app/api/infra/data/repositories/backofficeSupport/IBackofficeSupportRepository"
import { BackofficeSupportAccessUseCase } from "./BackofficeSupportAccessUseCase"

const TEAM: SupportTeamDetails = {
  id: "team-1",
  name: "Time Comercial",
  masterId: "master-1",
  masterName: "Imobiliária Horizonte",
  masterEmail: "contato@horizonte.com.br",
  isDefault: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  accountTeamsCount: 2,
}

const ACCOUNTS: SupportAccountSearchItem[] = [
  {
    masterId: "master-1",
    masterName: "Imobiliária Horizonte",
    masterEmail: "contato@horizonte.com.br",
    teams: [{ id: "team-1", name: "Time Comercial" }],
  },
]

function build(options: { isManager?: boolean; team?: SupportTeamDetails | null; auditFails?: boolean } = {}) {
  const isManager = options.isManager ?? true
  const audits: AuditLogEntry[] = []
  const searchAccounts = mock(async () => ACCOUNTS)
  const repository: IBackofficeSupportRepository = {
    findActiveSupportManager: async () =>
      isManager ? { backofficeUserId: "bo-1", email: "gestor@corretorstudio.com.br" } : null,
    searchAccounts,
    findActiveTeam: async () => (options && "team" in options ? (options.team ?? null) : TEAM),
  }
  const useCase = new BackofficeSupportAccessUseCase(repository, {
    logAudit: async (entry) => {
      if (options.auditFails) throw new Error("audit down")
      audits.push(entry)
    },
  })
  return { useCase, audits, searchAccounts }
}

describe("BackofficeSupportAccessUseCase.searchAccounts", () => {
  it("só o Manager do backoffice busca contas", async () => {
    const { useCase, searchAccounts } = build({ isManager: false })

    const output = await useCase.searchAccounts("profile-1", "horizonte")

    expect(output.isValid).toBe(false)
    expect(searchAccounts).not.toHaveBeenCalled()
  })

  it("busca curta não lista contas", async () => {
    const { useCase, searchAccounts } = build()

    const output = await useCase.searchAccounts("profile-1", " h ")

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual([])
    expect(searchAccounts).not.toHaveBeenCalled()
  })

  it("devolve as contas encontradas, com limite", async () => {
    const { useCase, searchAccounts } = build()

    const output = await useCase.searchAccounts("profile-1", "  horizonte ")

    expect(output.result).toEqual(ACCOUNTS)
    expect(searchAccounts).toHaveBeenCalledWith("horizonte", 8)
  })
})

describe("BackofficeSupportAccessUseCase.resolveTeamState", () => {
  it("quem não é Manager não busca e não tem time de suporte", async () => {
    const { useCase } = build({ isManager: false })

    expect(await useCase.resolveTeamState("profile-1", "team-1")).toEqual({
      canSupportSearch: false,
      supportTeam: null,
    })
  })

  it("Manager com time de cliente ativo recebe a linha marcada como suporte", async () => {
    const { useCase } = build()

    const state = await useCase.resolveTeamState("profile-1", "team-1")

    expect(state.canSupportSearch).toBe(true)
    expect(state.supportTeam).toMatchObject({
      id: "team-1",
      accountName: "Imobiliária Horizonte",
      isSupportAccess: true,
      role: "backoffice",
      accountAccessDecision: { state: "allowed" },
      accountTeamsCount: 2,
    })
  })

  it("Manager sem time ativo ou com time apagado só pode buscar", async () => {
    expect(await build().useCase.resolveTeamState("profile-1", null)).toEqual({
      canSupportSearch: true,
      supportTeam: null,
    })
    expect(await build({ team: null }).useCase.resolveTeamState("profile-1", "team-x")).toEqual({
      canSupportSearch: true,
      supportTeam: null,
    })
  })
})

describe("BackofficeSupportAccessUseCase.enterTeam", () => {
  it("registra quem entrou em qual conta", async () => {
    const { useCase, audits } = build()

    const team = await useCase.enterTeam("profile-1", "team-1")

    expect(team?.id).toBe("team-1")
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      entityType: "TEAM",
      entityId: "team-1",
      actorProfileId: "profile-1",
      metadata: {
        operation: "support_account_entered",
        masterProfileId: "master-1",
        actorKind: "backoffice_user",
        backofficeEmail: "gestor@corretorstudio.com.br",
      },
    })
  })

  it("quem não é Manager não entra e nada é registrado", async () => {
    const { useCase, audits } = build({ isManager: false })

    expect(await useCase.enterTeam("profile-1", "team-1")).toBeNull()
    expect(audits).toHaveLength(0)
  })

  it("time inexistente não entra", async () => {
    const { useCase, audits } = build({ team: null })

    expect(await useCase.enterTeam("profile-1", "team-x")).toBeNull()
    expect(audits).toHaveLength(0)
  })

  it("se a auditoria falhar, o acesso não é concedido", async () => {
    const { useCase } = build({ auditFails: true })

    await expect(useCase.enterTeam("profile-1", "team-1")).rejects.toThrow("audit down")
  })
})
