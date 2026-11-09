import { beforeEach, describe, expect, it, mock } from "bun:test"

type UpdateManyArgs = { where: Record<string, unknown>; data: Record<string, unknown> }

const tx = {
  lead: {
    findMany: mock(async (_args: { where: Record<string, unknown> }) => [
      { id: "lead-1", leadCode: "LD-1", name: "Maria", status: "new_opportunity" },
      { id: "lead-2", leadCode: "LD-2", name: "João", status: "scheduled" },
    ]),
    updateMany: mock(async (_args: UpdateManyArgs) => ({ count: 1 })),
  },
}

const executeRaw = mock(async (..._args: unknown[]) => 1)
const teamFindFirst = mock(async () => ({ masterId: "master-1", members: [{ profileId: "manager-1" }] }))
const notificationCreateMany = mock(async (_args: unknown) => ({ count: 2 }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    $executeRaw: executeRaw,
    team: { findFirst: teamFindFirst },
    notification: { createMany: notificationCreateMany },
  },
}))

const { MemberRemovalRepository } = await import("./MemberRemovalRepository")

beforeEach(() => {
  tx.lead.findMany.mockClear()
  tx.lead.updateMany.mockClear()
  executeRaw.mockClear()
})

describe("MemberRemovalRepository.releaseLeadsOfMember", () => {
  it("busca só leads do time, ativos e fora da carteira, onde o usuário é SDR ou closer", async () => {
    await new MemberRemovalRepository().releaseLeadsOfMember("team-1", "profile-1")

    expect(tx.lead.findMany.mock.calls[0][0].where).toEqual({
      teamId: "team-1",
      deletedAt: null,
      portfolio: { is: null },
      OR: [{ assignedTo: "profile-1" }, { closerId: "profile-1" }],
    })
  })

  it("zera SDR e closer só dos leads encontrados e devolve quais ficaram órfãos", async () => {
    const released = await new MemberRemovalRepository().releaseLeadsOfMember("team-1", "profile-1")

    const calls = tx.lead.updateMany.mock.calls.map(([args]) => args)
    expect(calls).toContainEqual({ where: { id: { in: ["lead-1", "lead-2"] }, assignedTo: "profile-1" }, data: { assignedTo: null } })
    expect(calls).toContainEqual({ where: { id: { in: ["lead-1", "lead-2"] }, closerId: "profile-1" }, data: { closerId: null } })
    expect(released.map((lead) => lead.id)).toEqual(["lead-1", "lead-2"])
  })

  it("sem leads, não atualiza nada", async () => {
    tx.lead.findMany.mockResolvedValueOnce([])

    expect(await new MemberRemovalRepository().releaseLeadsOfMember("team-1", "profile-1")).toEqual([])
    expect(tx.lead.updateMany).not.toHaveBeenCalled()
  })
})

describe("MemberRemovalRepository — destinatários, notificações e sessão", () => {
  it("destinatários da redistribuição: master e managers do time", async () => {
    expect(await new MemberRemovalRepository().findRedistributionRecipientIds("team-1")).toEqual(["master-1", "manager-1"])
  })

  it("grava as notificações em lote", async () => {
    const rows = [
      { recipientProfileId: "master-1", teamId: "team-1", type: "LEAD_ORPHANED" as const, message: "m", metadata: { leadId: "lead-1" } },
    ]

    await new MemberRemovalRepository().createLeadOrphanNotifications(rows)

    expect(notificationCreateMany).toHaveBeenCalledWith({ data: rows })
  })

  it("apaga as sessões de login do usuário pelo id da conta de login", async () => {
    await new MemberRemovalRepository().revokeAuthSessions("auth-1")

    const [strings, ...values] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    expect(strings.join("?")).toContain("DELETE FROM auth.sessions WHERE user_id =")
    expect(values).toEqual(["auth-1"])
  })
})
