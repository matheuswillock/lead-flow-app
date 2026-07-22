import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const emailContactListFindFirstMock = mock(async () => null as Record<string, unknown> | null)
const emailContactFindManyMock = mock(async () => [] as Record<string, unknown>[])
const emailContactCountMock = mock(async () => 0)
const emailEventFindManyMock = mock(async () => [] as Record<string, unknown>[])
const transactionMock = mock(async (ops: Promise<unknown>[]) => Promise.all(ops))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailContactList: {
      findFirst: emailContactListFindFirstMock,
    },
    emailContact: {
      findMany: emailContactFindManyMock,
      count: emailContactCountMock,
    },
    emailEvent: {
      findMany: emailEventFindManyMock,
    },
    $transaction: transactionMock,
  },
}))

const { EmailContactListUseCase } = await import(
  "@/app/api/useCases/email/EmailContactListUseCase"
)

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

describe("EmailContactListUseCase.listContacts — origem do descadastro", () => {
  beforeEach(() => {
    emailContactListFindFirstMock.mockClear()
    emailContactFindManyMock.mockClear()
    emailContactCountMock.mockClear()
    emailEventFindManyMock.mockClear()
    transactionMock.mockClear()
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it("na blocklist, anexa campanha e assunto do e-mail que gerou o descadastro", async () => {
    emailContactListFindFirstMock.mockResolvedValueOnce({
      id: "blocklist-1",
      teamId: "team-1",
      isBlocklist: true,
      isArchived: false,
    })

    const contacts = [
      {
        id: "c1",
        email: "maria@exemplo.com",
        name: "Maria",
        isUnsubscribed: true,
        isBounced: false,
        isComplained: false,
        createdAt: new Date("2026-07-21T18:00:00.000Z"),
      },
    ]
    emailContactFindManyMock.mockResolvedValueOnce(contacts)
    emailContactCountMock.mockResolvedValueOnce(1)

    emailEventFindManyMock.mockResolvedValueOnce([
      {
        occurredAt: new Date("2026-07-21T17:50:00.000Z"),
        log: {
          recipientEmail: "maria@exemplo.com",
          subject: "Uma ideia para otimizar sua corretora",
          campaignId: "camp-1",
          campaign: { id: "camp-1", name: "LEADS PME CORRETOR" },
        },
      },
    ])

    const uc = new EmailContactListUseCase()
    const output = await uc.listContacts("blocklist-1", teamCtx, {
      page: 1,
      pageSize: 20,
    })

    expect(output.isValid).toBe(true)
    expect(emailEventFindManyMock).toHaveBeenCalled()
    const result = output.result as {
      contacts: Array<{
        email: string
        unsubscribeSource: {
          campaignId: string | null
          campaignName: string | null
          subject: string | null
          unsubscribedAt: string
        } | null
      }>
    }
    expect(result.contacts[0]?.unsubscribeSource).toEqual({
      campaignId: "camp-1",
      campaignName: "LEADS PME CORRETOR",
      subject: "Uma ideia para otimizar sua corretora",
      unsubscribedAt: "2026-07-21T17:50:00.000Z",
    })
  })

  it("em lista normal, não busca eventos de descadastro e deixa unsubscribeSource null", async () => {
    emailContactListFindFirstMock.mockResolvedValueOnce({
      id: "list-1",
      teamId: "team-1",
      isBlocklist: false,
      isArchived: false,
    })

    emailContactFindManyMock.mockResolvedValueOnce([
      {
        id: "c1",
        email: "ok@exemplo.com",
        name: "Ok",
        isUnsubscribed: false,
        isBounced: false,
        isComplained: false,
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
      },
    ])
    emailContactCountMock.mockResolvedValueOnce(1)

    const uc = new EmailContactListUseCase()
    const output = await uc.listContacts("list-1", teamCtx, {
      page: 1,
      pageSize: 20,
    })

    expect(output.isValid).toBe(true)
    expect(emailEventFindManyMock).not.toHaveBeenCalled()
    const result = output.result as {
      contacts: Array<{ unsubscribeSource: unknown }>
    }
    expect(result.contacts[0]?.unsubscribeSource).toBeNull()
  })
})
