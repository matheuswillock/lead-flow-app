import { describe, expect, it, mock, beforeEach } from "bun:test"
import { generateEmailUnsubscribeToken } from "@/lib/email/unsubscribe-token"

const findFirstMock = mock(async () => null as Record<string, unknown> | null)
const findManyMock = mock(async () => [] as Record<string, unknown>[])
const deleteManyMock = mock(async () => ({ count: 0 }))
const countMock = mock(async () => 0)
const updateMock = mock(async () => ({}))
const upsertMock = mock(async () => ({}))
/**
 * `blockTeamEmail` lê a linha atual antes do upsert para não rebaixar o motivo
 * nem reiniciar `blockedAt`. Null = endereço ainda não estava bloqueado.
 */
const findUniqueContactMock = mock(
  async () => null as { blockReason: string | null; blockedAt: Date | null } | null
)
const createMock = mock(async () => ({ id: "blocklist-id" }))
const createEventMock = mock(async () => ({}))
const transactionMock = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    emailContact: {
      findMany: findManyMock,
      deleteMany: deleteManyMock,
      count: countMock,
      upsert: upsertMock,
      findUnique: findUniqueContactMock,
    },
    emailContactList: {
      findFirst: findFirstMock,
      create: createMock,
      update: updateMock,
    },
    emailLog: {
      findFirst: findFirstMock,
    },
    emailEvent: {
      create: createEventMock,
    },
  }
  return fn(tx)
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailContact: {
      findFirst: findFirstMock,
      findMany: findManyMock,
    },
    emailCampaign: {
      findFirst: findFirstMock,
    },
    $transaction: transactionMock,
  },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
  getEmailCronPrisma: () => ({
    emailContact: {
      findFirst: findFirstMock,
      findMany: findManyMock,
    },
    emailCampaign: {
      findFirst: findFirstMock,
    },
    $transaction: transactionMock,
  }),
}))

mock.module("@/app/api/useCases/email/EmailCampaignAudiencePruneUseCase", () => ({
  emailCampaignAudiencePruneUseCase: {
    queueCampaignAudiencePrune: mock(() => {}),
    queuePruneForSuppressedEmail: mock(() => {}),
    queuePruneForComplaint: mock(() => {}),
  },
}))

const { EmailUnsubscribeUseCase } = await import("@/app/api/useCases/email/EmailUnsubscribeUseCase")

describe("EmailUnsubscribeUseCase", () => {
  const useCase = new EmailUnsubscribeUseCase()
  const contactId = "11111111-1111-4111-8111-111111111111"
  const teamId = "22222222-2222-4222-8222-222222222222"
  const campaignId = "33333333-3333-4333-8333-333333333333"

  beforeEach(() => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-for-unsubscribe"
    findFirstMock.mockClear()
    findManyMock.mockClear()
    deleteManyMock.mockClear()
    countMock.mockClear()
    updateMock.mockClear()
    upsertMock.mockClear()
    createMock.mockClear()
    createEventMock.mockClear()
    transactionMock.mockClear()
  })

  it("rejeita token inválido", async () => {
    const output = await useCase.unsubscribe("token-invalido", "all")
    expect(output.isValid).toBe(false)
  })

  it("scope all move contato para blocklist", async () => {
    const token = generateEmailUnsubscribeToken(contactId, teamId, campaignId)

    findFirstMock
      .mockResolvedValueOnce({
        id: contactId,
        email: "maria@exemplo.com",
        name: "Maria",
        list: { createdBy: "44444444-4444-4444-8444-444444444444" },
      })
      .mockResolvedValueOnce({
        id: campaignId,
        contactListId: "55555555-5555-4555-8555-555555555555",
        createdBy: "44444444-4444-4444-8444-444444444444",
        contactList: { id: "55555555-5555-4555-8555-555555555555", isSystemDefault: false, isBlocklist: false },
      })
      .mockResolvedValueOnce({ id: "blocklist-id" })
      .mockResolvedValueOnce({ id: "log-id", events: [] })

    findManyMock
      .mockResolvedValueOnce([
        {
          id: contactId,
          listId: "55555555-5555-4555-8555-555555555555",
          list: { isSystemDefault: false },
        },
      ])
      .mockResolvedValueOnce([{ listId: "55555555-5555-4555-8555-555555555555" }])
    countMock.mockResolvedValue(0)

    const output = await useCase.unsubscribe(token, "all")
    expect(output.isValid).toBe(true)
    expect(upsertMock).toHaveBeenCalled()
    expect(createEventMock).toHaveBeenCalled()
  })

  it("getInfo retorna link inválido para token malformado", async () => {
    const output = await useCase.getInfo("bad-token")
    expect(output.isValid).toBe(false)
  })
})
