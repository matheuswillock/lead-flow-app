import { describe, expect, it, mock } from "bun:test"
import { UserRole } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

mock.module("@/app/api/services/whatsapp/WhatsAppConversationAccessService", () => ({
  assertCanAccessConversation: mock(async () => ({
    id: "conv-group",
    teamId: "team-1",
    leadId: null,
    externalChatId: "120363123456789012@g.us",
    normalizedPhone: null,
    contactPhone: null,
  })),
  WhatsAppAccessDeniedError: class WhatsAppAccessDeniedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "WhatsAppAccessDeniedError"
    }
  },
}))

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead: mock(async () => {
      throw new Error("should not create lead for group")
    }),
  },
}))

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    updateConversation: mock(async () => ({})),
  },
}))

mock.module("@/app/api/infra/data/repositories/lead/LeadRepository", () => ({
  LeadRepository: class {
    findByPhone = mock(async () => null)
  },
}))

const { createLeadFromConversationUseCase } = await import("./CreateLeadFromConversationUseCase")

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

describe("CreateLeadFromConversationUseCase", () => {
  it("bloqueia criação de lead a partir de grupo", async () => {
    const output = await createLeadFromConversationUseCase.execute({
      conversationId: "conv-group",
      name: "Grupo Teste",
      access: makeAccess(),
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("grupo")
  })
})
