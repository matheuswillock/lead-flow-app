import { describe, expect, it, mock } from "bun:test"
import { UserRole } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const updateConversationMock = mock(async () => ({
  id: "conv-1",
  handoffMode: "BOT",
}))
const createAuditEventMock = mock(async () => ({ id: "audit-1" }))

mock.module("@/app/api/services/whatsapp/WhatsAppConversationAccessService", () => ({
  assertCanAccessConversation: mock(async () => ({
    id: "conv-1",
    teamId: "team-1",
    handoffMode: "HUMAN",
  })),
  WhatsAppAccessDeniedError: class WhatsAppAccessDeniedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "WhatsAppAccessDeniedError"
    }
  },
}))

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    updateConversation: updateConversationMock,
    createAuditEvent: createAuditEventMock,
  },
}))

const { setConversationHandoffUseCase } = await import("./SetConversationHandoffUseCase")

function makeAccess(): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId: "team-1",
    profileId: "profile-1",
    profileEmail: "user@test.com",
    profileName: "User",
    isMaster: true,
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: { role: UserRole.manager, functions: [] },
  }
}

describe("SetConversationHandoffUseCase", () => {
  it("devolve conversa ao bot", async () => {
    const output = await setConversationHandoffUseCase.execute({
      teamId: "team-1",
      conversationId: "conv-1",
      mode: "BOT",
      access: makeAccess(),
    })

    expect(output.isValid).toBe(true)
    expect(updateConversationMock).toHaveBeenCalledWith("conv-1", { handoffMode: "BOT" })
    expect(createAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "conversation.handoff",
      actorProfileId: "profile-1",
    }))
  })
})
