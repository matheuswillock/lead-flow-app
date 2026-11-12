import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/lib/utils/app-url", () => ({ getFullUrl: (p: string) => `https://example.test${p}` }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: () => "https://example.test/x" }))
mock.module("@/app/api/useCases/audit/AuditLogWriter", () => ({ auditLogWriter: { logAudit: async () => {} } }))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => ({ auth: { admin: {} } }) }))
const emailServiceStub = {
  sendOperatorInviteEmail: async () => {},
  sendGenericEmail: async () => {},
  sendEmail: async () => {},
  sendAddOnPendingPaymentEmail: async () => {},
}
mock.module("@/lib/services/EmailService", () => ({
  EmailService: class {},
  createEmailService: () => emailServiceStub,
  getEmailService: () => emailServiceStub,
  emailService: emailServiceStub,
}))

const { ManagerAccountUsersUseCase } = await import("./ManagerAccountUsersUseCase")

function build(order: string[]) {
  const repository = {
    findTeamNameById: mock(async () => ({ name: "Time" })),
    findProfileLabelById: mock(async () => ({ fullName: "Gestor", email: "g@x.com" })),
    findTeamMember: mock(async () => ({ id: "tm-1", role: "operator" })),
    deleteTeamMember: mock(async () => {
      order.push("deleteTeamMember")
    }),
  }
  const notifications = { createTeamMembershipNotification: mock(async () => {}) }
  const memberProBilling = { syncBillingAfterUsageChange: mock(async () => {}) }
  const followUp = {
    handle: mock(async (_input: { teamId: string; removedProfileId: string }) => {
      order.push("followUp")
      return { releasedLeads: 0, notifiedLeads: 0, sessionsRevoked: true }
    }),
  }
  const useCase = new ManagerAccountUsersUseCase(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    memberProBilling as never,
    {} as never,
    followUp as never,
  )
  return { useCase, followUp }
}

const ctx = { teamId: "team-1", profileId: "actor-1", managerId: "master-1", isMaster: true }

describe("ManagerAccountUsersUseCase — remoção libera leads e derruba a sessão", () => {
  it("removeAccountUser: depois de apagar o vínculo, libera os leads e encerra a sessão", async () => {
    const order: string[] = []
    const { useCase, followUp } = build(order)

    const { status } = await useCase.removeAccountUser({ ctx, userId: "user-1" })

    expect(status).toBe(200)
    expect(followUp.handle).toHaveBeenCalledWith({ teamId: "team-1", removedProfileId: "user-1" })
    expect(order).toEqual(["deleteTeamMember", "followUp"])
  })

  it("dissociateTeamMember: mesmo tratamento", async () => {
    const order: string[] = []
    const { useCase, followUp } = build(order)

    const { status } = await useCase.dissociateTeamMember({ ctx, userData: { profileId: "user-2" } as never })

    expect(status).toBe(200)
    expect(followUp.handle).toHaveBeenCalledWith({ teamId: "team-1", removedProfileId: "user-2" })
    expect(order).toEqual(["deleteTeamMember", "followUp"])
  })

  it("não remover o master: nada é liberado", async () => {
    const order: string[] = []
    const { useCase, followUp } = build(order)

    const { status } = await useCase.removeAccountUser({ ctx, userId: "master-1" })

    expect(status).toBe(400)
    expect(followUp.handle).not.toHaveBeenCalled()
  })
})
