import { describe, expect, it, mock } from "bun:test"
import type {
  IMemberRemovalRepository,
  OrphanNotificationRow,
  ReleasedLead,
} from "@/app/api/infra/data/repositories/memberRemoval/IMemberRemovalRepository"

// O invalidador de cache de notificações importa `server-only`, que não carrega fora do Next.
mock.module("server-only", () => ({}))
const { MemberRemovalFollowUpService } = await import("./MemberRemovalFollowUpService")

const TEAM = "team-1"
const REMOVED = "profile-removed"

const openLead = (id: string, name: string): ReleasedLead => ({ id, leadCode: `LD-${id}`, name, status: "new_opportunity" })
const lostLead: ReleasedLead = { id: "lost", leadCode: "LD-lost", name: "Lead perdido", status: "opportunityLost" }

function build(overrides: Record<string, unknown> = {}) {
  const base = {
    releaseLeadsOfMember: mock(async (): Promise<ReleasedLead[]> => [openLead("a", "Maria"), openLead("b", "João")]),
    findRedistributionRecipientIds: mock(async () => ["master-1", "manager-1", REMOVED]),
    findProfileForRemoval: mock(async () => ({
      fullName: "Ana Closer" as string | null,
      email: "ana@x.com",
      supabaseId: "auth-1" as string | null,
    })),
    createLeadOrphanNotifications: mock(async (rows: OrphanNotificationRow[]) => ({ count: rows.length })),
    revokeAuthSessions: mock(async (_authUserId: string) => {}),
    countRemainingTeamMemberships: mock(async (_profileId: string) => 0),
    moveActiveTeamAway: mock(async (_profileId: string, _removedTeamId: string) => {}),
  }
  const repo = { ...base, ...overrides } as typeof base
  const invalidate = mock((_input: { recipientProfileIds: string[] }) => {})
  const service = new MemberRemovalFollowUpService(repo as IMemberRemovalRepository, invalidate)
  return { repo, invalidate, service }
}

describe("MemberRemovalFollowUpService — leads órfãos", () => {
  it("libera os leads do time do usuário removido", async () => {
    const { repo, service } = build()

    await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.releaseLeadsOfMember).toHaveBeenCalledWith(TEAM, REMOVED)
  })

  it("gera uma notificação por lead aberto para cada master e manager, sem avisar o removido", async () => {
    const { repo, service } = build()

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    const rows = repo.createLeadOrphanNotifications.mock.calls[0][0]
    expect(rows).toHaveLength(4) // 2 leads x 2 destinatários
    expect(rows.map((row) => row.recipientProfileId).sort()).toEqual(["manager-1", "manager-1", "master-1", "master-1"])
    expect(rows.every((row) => row.type === "LEAD_ORPHANED" && row.teamId === TEAM)).toBe(true)
    expect(rows[0].message).toContain("Ana Closer")
    expect(rows[0].metadata).toMatchObject({ leadId: "a", leadCode: "LD-a", leadName: "Maria" })
    expect(result).toMatchObject({ releasedLeads: 2, notifiedLeads: 2 })
  })

  it("lead já encerrado fica sem responsável mas não gera notificação", async () => {
    const { repo, service } = build({
      releaseLeadsOfMember: mock(async () => [openLead("a", "Maria"), lostLead]),
    })

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    const rows = repo.createLeadOrphanNotifications.mock.calls[0][0]
    expect(rows.map((row) => row.metadata.leadId)).toEqual(["a", "a"])
    expect(result).toMatchObject({ releasedLeads: 2, notifiedLeads: 1 })
  })

  it("sem leads órfãos não cria notificação", async () => {
    const { repo, service } = build({ releaseLeadsOfMember: mock(async () => []) })

    await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.createLeadOrphanNotifications).not.toHaveBeenCalled()
  })

  it("atualiza o contador de notificações de quem recebeu", async () => {
    const { invalidate, service } = build()

    await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(invalidate).toHaveBeenCalledWith({ recipientProfileIds: ["master-1", "manager-1"] })
  })
})

describe("MemberRemovalFollowUpService — sessão do removido", () => {
  it("encerra na hora as sessões abertas do usuário removido", async () => {
    const { repo, service } = build()

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.revokeAuthSessions).toHaveBeenCalledWith("auth-1")
    expect(result.sessionsRevoked).toBe(true)
  })

  it("quem tem acesso normal em outro time não perde a sessão e passa a usar o outro time", async () => {
    const { repo, service } = build({ countRemainingTeamMemberships: mock(async () => 2) })

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.revokeAuthSessions).not.toHaveBeenCalled()
    expect(repo.moveActiveTeamAway).toHaveBeenCalledWith(REMOVED, TEAM)
    expect(result.sessionsRevoked).toBe(false)
  })

  it("sem nenhum outro time, a sessão cai e não há time para trocar", async () => {
    const { repo, service } = build()

    await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.moveActiveTeamAway).not.toHaveBeenCalled()
  })

  it("se não der para contar os outros times, mantém a sessão (não derruba por engano)", async () => {
    const { repo, service } = build({
      countRemainingTeamMemberships: mock(async () => {
        throw new Error("banco indisponível")
      }),
    })

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.revokeAuthSessions).not.toHaveBeenCalled()
    expect(result.sessionsRevoked).toBe(false)
  })

  it("convite pendente sem conta de login não tem sessão para encerrar", async () => {
    const { repo, service } = build({
      findProfileForRemoval: mock(async () => ({ fullName: "Pendente", email: "p@x.com", supabaseId: null })),
    })

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.revokeAuthSessions).not.toHaveBeenCalled()
    expect(result.sessionsRevoked).toBe(false)
  })
})

describe("MemberRemovalFollowUpService — falhas isoladas", () => {
  it("se liberar os leads falhar, ainda encerra a sessão e não propaga o erro", async () => {
    const { repo, service } = build({
      releaseLeadsOfMember: mock(async () => {
        throw new Error("banco indisponível")
      }),
    })

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.revokeAuthSessions).toHaveBeenCalledWith("auth-1")
    expect(result.releasedLeads).toBe(0)
  })

  it("se encerrar a sessão falhar, os leads já foram liberados e avisados", async () => {
    const { repo, service } = build({
      revokeAuthSessions: mock(async () => {
        throw new Error("sem permissão")
      }),
    })

    const result = await service.handle({ teamId: TEAM, removedProfileId: REMOVED })

    expect(repo.createLeadOrphanNotifications).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ releasedLeads: 2, sessionsRevoked: false })
  })
})
