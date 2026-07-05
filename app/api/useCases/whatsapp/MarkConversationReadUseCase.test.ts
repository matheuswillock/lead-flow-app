import { describe, expect, it, mock } from "bun:test"
import { UserRole } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { IWhatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import type { IWhatsAppProvider } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider"

const CONVERSATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TEAM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PROFILE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

mock.module("@/app/api/services/whatsapp/WhatsAppConversationAccessService", () => ({
  assertCanAccessConversation: mock(async () => {}),
  WhatsAppAccessDeniedError: class WhatsAppAccessDeniedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "WhatsAppAccessDeniedError"
    }
  },
}))

const {
  MarkConversationReadUseCase,
  buildReadReceiptPayload,
  resolveInboundProviderMessageId,
} = await import("./MarkConversationReadUseCase")

function makeAccess(): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId: TEAM_ID,
    profileId: PROFILE_ID,
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

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: CONVERSATION_ID,
    teamId: TEAM_ID,
    configId: "config-1",
    leadId: null,
    externalChatId: "5511999999999@s.whatsapp.net",
    contactPhone: "5511999999999",
    contactName: "Contato",
    contactNameSource: "PUSH_NAME",
    contactAvatarUrl: null,
    normalizedPhone: "5511999999999",
    assignedProfileId: null,
    createdByProfileId: null,
    lastMessageAt: new Date(),
    lastMessagePreview: "Oi",
    unreadCount: 3,
    isArchived: false,
    handoffMode: "HUMAN",
    welcomeSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: "config-1",
    teamId: TEAM_ID,
    provider: "EVOLUTION",
    instanceName: "team_instance",
    instanceId: "inst-1",
    phoneNumber: null,
    normalizedPhone: null,
    primaryConfigId: null,
    displayName: null,
    status: "CONNECTED",
    qrCodeText: null,
    qrCodeImageUrl: null,
    webhookSecret: "secret",
    hostBaseUrl: "https://evo.test",
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastSyncAt: null,
    historySyncStatus: "IDLE",
    historySyncStartedAt: null,
    historySyncCompletedAt: null,
    historySyncError: null,
    usageLimitMonthly: 2000,
    billingEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildRepositoryStub(overrides: Partial<IWhatsAppRepository> = {}): IWhatsAppRepository {
  const conversation = makeConversation()
  const updatedConversation = { ...conversation, unreadCount: 0 }

  return {
    findConversationByIdForTeam: mock(async () => conversation),
    updateConversation: mock(async () => updatedConversation),
    findConfigByTeamId: mock(async () => makeConfig()),
    resolveEffectiveConfig: mock(async (config) => config),
    listInboundPendingReadReceipt: mock(async () => [
      {
        id: "msg-db-1",
        providerMessageId: "evo-msg-1",
        rawPayload: { key: { id: "evo-msg-1" } },
      },
    ]),
    bulkSetInboundBrokerReadAt: mock(async () => 1),
    ...overrides,
  } as unknown as IWhatsAppRepository
}

function buildProviderStub(overrides: Partial<IWhatsAppProvider> = {}): IWhatsAppProvider {
  return {
    markMessagesAsRead: mock(async () => {}),
    ...overrides,
  } as unknown as IWhatsAppProvider
}

describe("resolveInboundProviderMessageId", () => {
  it("usa providerMessageId quando presente", () => {
    expect(
      resolveInboundProviderMessageId({
        id: "db-1",
        providerMessageId: "provider-1",
        rawPayload: {},
      })
    ).toBe("provider-1")
  })

  it("extrai id de rawPayload.key quando providerMessageId ausente", () => {
    expect(
      resolveInboundProviderMessageId({
        id: "db-1",
        providerMessageId: null,
        rawPayload: { key: { id: "from-payload" } },
      })
    ).toBe("from-payload")
  })
})

describe("buildReadReceiptPayload", () => {
  it("monta readMessages com externalChatId e fromMe false", () => {
    const result = buildReadReceiptPayload(
      [
        {
          id: "db-1",
          providerMessageId: "evo-1",
          rawPayload: {},
        },
      ],
      "5511999999999@s.whatsapp.net"
    )

    expect(result.readMessages).toEqual([
      {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: "evo-1",
      },
    ])
    expect(result.messageIds).toEqual(["db-1"])
  })
})

describe("MarkConversationReadUseCase", () => {
  it("zera unreadCount e envia read receipt ao provider", async () => {
    const repository = buildRepositoryStub()
    const provider = buildProviderStub()
    const useCase = new MarkConversationReadUseCase(repository, provider)

    const output = await useCase.execute(CONVERSATION_ID, makeAccess())

    expect(output.isValid).toBe(true)
    expect(repository.updateConversation).toHaveBeenCalledWith(CONVERSATION_ID, { unreadCount: 0 })
    expect(provider.markMessagesAsRead).toHaveBeenCalledWith({
      instanceName: "team_instance",
      readMessages: [
        {
          remoteJid: "5511999999999@s.whatsapp.net",
          fromMe: false,
          id: "evo-msg-1",
        },
      ],
      hostBaseUrl: "https://evo.test",
    })
    expect(repository.bulkSetInboundBrokerReadAt).toHaveBeenCalled()
    expect((output.result as { readReceiptSent: boolean }).readReceiptSent).toBe(true)
  })

  it("não chama provider quando instância não está CONNECTED", async () => {
    const repository = buildRepositoryStub({
      findConfigByTeamId: mock(async () => makeConfig({ status: "DISCONNECTED" })),
    })
    const provider = buildProviderStub()
    const useCase = new MarkConversationReadUseCase(repository, provider)

    const output = await useCase.execute(CONVERSATION_ID, makeAccess())

    expect(output.isValid).toBe(true)
    expect(provider.markMessagesAsRead).not.toHaveBeenCalled()
    expect((output.result as { readReceiptSent: boolean }).readReceiptSent).toBe(false)
  })

  it("é idempotente quando não há mensagens pendentes", async () => {
    const repository = buildRepositoryStub({
      listInboundPendingReadReceipt: mock(async () => []),
    })
    const provider = buildProviderStub()
    const useCase = new MarkConversationReadUseCase(repository, provider)

    const output = await useCase.execute(CONVERSATION_ID, makeAccess())

    expect(output.isValid).toBe(true)
    expect(provider.markMessagesAsRead).not.toHaveBeenCalled()
    expect(repository.bulkSetInboundBrokerReadAt).not.toHaveBeenCalled()
  })

  it("mantém sucesso quando provider falha após zerar unread", async () => {
    const repository = buildRepositoryStub()
    const provider = buildProviderStub({
      markMessagesAsRead: mock(async () => {
        throw new Error("Evo offline")
      }),
    })
    const useCase = new MarkConversationReadUseCase(repository, provider)

    const output = await useCase.execute(CONVERSATION_ID, makeAccess())

    expect(output.isValid).toBe(true)
    expect(repository.updateConversation).toHaveBeenCalled()
    expect(repository.bulkSetInboundBrokerReadAt).not.toHaveBeenCalled()
    expect((output.result as { readReceiptSent: boolean }).readReceiptSent).toBe(false)
  })
})
