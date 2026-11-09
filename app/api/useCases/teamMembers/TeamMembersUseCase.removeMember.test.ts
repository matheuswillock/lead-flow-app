import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, revalidateTag: () => {}, updateTag: () => {} }))
mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: { createTeamMembershipNotification: async () => {} },
}))
mock.module("@/app/api/services/audit/AuditLogService", () => ({ auditLogService: { logAudit: async () => {} } }))
mock.module("@/app/api/useCases/billing/MemberProBillingUseCase", () => ({
  memberProBillingUseCase: { syncBillingAfterUsageChange: async () => {} },
}))
mock.module("@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService", () => ({
  backofficeOperationalAccessService: {},
}))
mock.module("@/app/api/services/multiskillTransfer/MultiskillTransferService", () => ({ multiskillTransferService: {} }))

const { TeamMembersUseCase } = await import("./TeamMembersUseCase")

function build(order: string[]) {
  const repository = {
    findRequesterProfile: mock(async () => ({ id: "master-1", fullName: "Master", email: "m@x.com" })),
    findTeam: mock(async () => ({ id: "team-1", name: "Time", masterId: "master-1" })),
    findMemberSnapshot: mock(async () => null),
    deleteMember: mock(async () => {
      order.push("deleteMember")
    }),
  }
  const followUp = {
    handle: mock(async (_input: { teamId: string; removedProfileId: string }) => {
      order.push("followUp")
      return { releasedLeads: 0, notifiedLeads: 0, sessionsRevoked: true }
    }),
  }
  const useCase = new TeamMembersUseCase(repository as never, followUp as never)
  return { useCase, repository, followUp }
}

describe("TeamMembersUseCase.removeMember — depois de remover", () => {
  it("libera os leads, avisa os managers e derruba a sessão depois de apagar o vínculo", async () => {
    const order: string[] = []
    const { useCase, followUp } = build(order)

    const output = await useCase.removeMember("sb-master", "team-1", "member-1")

    expect(output.isValid).toBe(true)
    expect(followUp.handle).toHaveBeenCalledWith({ teamId: "team-1", removedProfileId: "member-1" })
    expect(order).toEqual(["deleteMember", "followUp"])
  })

  it("quem não é master não remove e nada é liberado", async () => {
    const order: string[] = []
    const { useCase, repository, followUp } = build(order)
    repository.findRequesterProfile.mockResolvedValue({ id: "outro", fullName: "Outro", email: "o@x.com" })

    const output = await useCase.removeMember("sb-outro", "team-1", "member-1")

    expect(output.isValid).toBe(false)
    expect(followUp.handle).not.toHaveBeenCalled()
  })
})
