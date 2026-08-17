import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

// =============================================================================
// MOCKS — declarar ANTES de qualquer await import()
// =============================================================================

const emailTemplateFindFirstMock = mock(async (..._args: unknown[]) => null as unknown)
const emailTemplateUpdateMock = mock(async (..._args: unknown[]) => ({}) as unknown)
const emailTemplateHistoryCreateMock = mock(async (..._args: unknown[]) => ({ id: "hist-1" }))
const emailTeamSettingsFindUniqueMock = mock(async (): Promise<unknown> => null)
const emailTeamVariableFindManyMock = mock(async (..._args: unknown[]) => [] as unknown[])
const transactionMock = mock(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock))

const prismaMock = {
  emailTemplate: {
    findFirst: emailTemplateFindFirstMock,
    update: emailTemplateUpdateMock,
    updateMany: mock(async () => ({ count: 0 })),
  },
  emailTeamSettings: {
    findUnique: emailTeamSettingsFindUniqueMock,
  },
  emailTemplateHistory: {
    create: emailTemplateHistoryCreateMock,
  },
  emailTeamVariable: {
    findMany: emailTeamVariableFindManyMock,
  },
  $transaction: transactionMock,
}
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const allMocks = [
  emailTemplateFindFirstMock,
  emailTemplateUpdateMock,
  emailTemplateHistoryCreateMock,
  emailTeamSettingsFindUniqueMock,
  emailTeamVariableFindManyMock,
  transactionMock,
]

const { EmailTemplateUseCase } = await import("./EmailTemplateUseCase")

const teamCtx: TeamAccess = {
  supabaseId: "supa-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "test@test.com",
  profileName: "Test User",
  isMaster: false,
  managerId: "manager-1",
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  canTransferAccountLeads: false,
  canViewAllTeams: false,
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] },
}

describe("EmailTemplateUseCase.approve — validação de variáveis não resolvidas", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => null)
    emailTeamVariableFindManyMock.mockImplementation(async () => [])
    transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock))
  })

  it("aprova quando o template usa alias de descadastro (unsubscribe_url)", async () => {
    emailTemplateFindFirstMock.mockImplementation(async () => ({
      id: "tpl-1",
      subject: "Assunto {{nome}}",
      html: "<p>Olá {{nome}}, cancele em {{unsubscribe_url}}</p>",
      variables: [],
    }))
    emailTemplateUpdateMock.mockImplementation(async () => ({
      id: "tpl-1",
      versionNumber: 1,
    }))

    const uc = new EmailTemplateUseCase()
    const output = await uc.approve("tpl-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(emailTemplateUpdateMock).toHaveBeenCalled()
  })

  it("aprova normalmente quando só há tokens nativos (nome/email/link_descadastro)", async () => {
    emailTemplateFindFirstMock.mockImplementation(async () => ({
      id: "tpl-1",
      subject: "Assunto {{nome}}",
      html: "<p>Olá {{nome}}, cancele em {{link_descadastro}}</p>",
      variables: [],
    }))
    emailTemplateUpdateMock.mockImplementation(async () => ({
      id: "tpl-1",
      versionNumber: 1,
    }))

    const uc = new EmailTemplateUseCase()
    const output = await uc.approve("tpl-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(emailTemplateUpdateMock).toHaveBeenCalled()
  })

  it("aprova quando o token custom tem valor de default global do time", async () => {
    emailTemplateFindFirstMock.mockImplementation(async () => ({
      id: "tpl-1",
      subject: "Assunto {{nome}}",
      html: "<p>{{telefone_suporte}}</p>",
      variables: [],
    }))
    emailTeamVariableFindManyMock.mockImplementation(async () => [
      { key: "telefone_suporte", defaultValue: "0800-123" },
    ])
    emailTemplateUpdateMock.mockImplementation(async () => ({
      id: "tpl-1",
      versionNumber: 1,
    }))

    const uc = new EmailTemplateUseCase()
    const output = await uc.approve("tpl-1", teamCtx)

    expect(output.isValid).toBe(true)
  })
})

describe("EmailTemplateUseCase.publish — validação de variáveis não resolvidas", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      templateApprovalRequired: false,
    }))
    emailTeamVariableFindManyMock.mockImplementation(async () => [])
    transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock))
  })

  it("bloqueia publicação quando o template tem token custom não resolvido", async () => {
    emailTemplateFindFirstMock.mockImplementation(async () => ({
      id: "tpl-1",
      subject: "Assunto",
      html: "<p>Preço {{preco_plano}}</p>",
      variables: [],
      approvalStatus: "approved",
      approvedAt: new Date(),
      versionGroupId: "vg-1",
    }))

    const uc = new EmailTemplateUseCase()
    const output = await uc.publish("tpl-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("Variáveis sem valor suficiente")
    expect(output.errorMessages.join(" ")).toContain("preco_plano")
    expect(emailTemplateUpdateMock).not.toHaveBeenCalled()
  })

  it("publica quando o HTML usa alias unsubscribe_url", async () => {
    emailTemplateFindFirstMock.mockImplementation(async () => ({
      id: "tpl-1",
      subject: "Assunto",
      html: "<p>Cancele em {{unsubscribe_url}}</p>",
      variables: [],
      approvalStatus: "approved",
      approvedAt: new Date(),
      versionGroupId: "vg-1",
    }))
    emailTemplateUpdateMock.mockImplementation(async () => ({
      id: "tpl-1",
      versionNumber: 1,
    }))

    const uc = new EmailTemplateUseCase()
    const output = await uc.publish("tpl-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(emailTemplateUpdateMock).toHaveBeenCalled()
  })

  it("publica normalmente quando não há token não resolvido", async () => {
    emailTemplateFindFirstMock.mockImplementation(async () => ({
      id: "tpl-1",
      subject: "Assunto {{nome}}",
      html: "<p>Olá {{nome}}, cancele em {{link_descadastro}}</p>",
      variables: [],
      approvalStatus: "approved",
      approvedAt: new Date(),
      versionGroupId: "vg-1",
    }))
    emailTemplateUpdateMock.mockImplementation(async () => ({
      id: "tpl-1",
      versionNumber: 1,
    }))

    const uc = new EmailTemplateUseCase()
    const output = await uc.publish("tpl-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(emailTemplateUpdateMock).toHaveBeenCalled()
  })
})
