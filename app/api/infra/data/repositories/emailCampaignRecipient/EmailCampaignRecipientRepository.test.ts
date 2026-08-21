import { beforeEach, describe, expect, it, mock } from "bun:test"

const emailContactFindManyMock = mock(async () => [] as Array<{ email: string }>)
const emailContactCountMock = mock(async () => 0)
const emailContactListFindFirstMock = mock(
  async () =>
    null as {
      id: string
      teamId: string
      isBlocklist: boolean
      isSystemDefault?: boolean
    } | null
)
const queryRawMock = mock(
  async (): Promise<
    Array<
      | { count: bigint }
      | { bounced: bigint; unsubscribed: bigint; complained: bigint }
      | { id: string; email: string; name: string | null; customFields: unknown }
    >
  > => [{ count: BigInt(0) }]
)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailContact: {
      findMany: emailContactFindManyMock,
      count: emailContactCountMock,
    },
    emailContactList: {
      findFirst: emailContactListFindFirstMock,
    },
    $queryRaw: queryRawMock,
  },
}))

const { EmailCampaignRecipientRepository } = await import("./EmailCampaignRecipientRepository")

function sqlFromQueryRawCall(call: unknown[] | undefined): string {
  const first = call?.[0]
  if (first && typeof first === "object" && "strings" in first) {
    return Array.from((first as { strings: readonly string[] }).strings).join(" ")
  }
  const strings = first as TemplateStringsArray | undefined
  const fragments = strings ? Array.from(strings) : []
  const values = (call ?? []).slice(1).map((value) => {
    if (value && typeof value === "object" && "strings" in value) {
      return Array.from((value as { strings: readonly string[] }).strings).join(" ")
    }
    return String(value)
  })
  return [...fragments, ...values].join(" ")
}

describe("EmailCampaignRecipientRepository counts", () => {
  beforeEach(() => {
    emailContactFindManyMock.mockClear()
    emailContactCountMock.mockClear()
    emailContactListFindFirstMock.mockClear()
    queryRawMock.mockClear()
    emailContactFindManyMock.mockImplementation(async () => [])
    emailContactCountMock.mockImplementation(async () => 0)
    emailContactListFindFirstMock.mockImplementation(async () => null)
    queryRawMock.mockImplementation(async () => [{ count: BigInt(0) }])
  })

  it("countActiveRecipientsForList usa count() com os mesmos filtros de findMany", async () => {
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      teamId: "team-1",
      isBlocklist: false,
    }))
    emailContactFindManyMock.mockImplementation(async () => [{ email: "blocked@example.com" }])
    emailContactCountMock.mockImplementation(async () => 12)

    const repo = new EmailCampaignRecipientRepository()
    const count = await repo.countActiveRecipientsForList("list-1")

    expect(count).toBe(12)
    expect(emailContactCountMock).toHaveBeenCalledTimes(1)
    const args = emailContactCountMock.mock.calls[0] as unknown as [
      {
        where: {
          listId: string
          isUnsubscribed: boolean
          isBounced: boolean
          isComplained: boolean
          email: { notIn: string[] }
        }
      },
    ]
    expect(args[0].where.listId).toBe("list-1")
    expect(args[0].where.isUnsubscribed).toBe(false)
    expect(args[0].where.isBounced).toBe(false)
    expect(args[0].where.isComplained).toBe(false)
    expect(args[0].where.email).toEqual({ notIn: ["blocked@example.com"] })
  })

  it("countActiveRecipientsForList retorna 0 para lista inexistente ou blocklist", async () => {
    const repo = new EmailCampaignRecipientRepository()
    expect(await repo.countActiveRecipientsForList("missing")).toBe(0)

    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "blocklist-1",
      teamId: "team-1",
      isBlocklist: true,
    }))
    expect(await repo.countActiveRecipientsForList("blocklist-1")).toBe(0)
    expect(emailContactCountMock).not.toHaveBeenCalled()
  })

  it("findActiveRecipientsForList aplica skip/take na query paginada", async () => {
    emailContactListFindFirstMock.mockImplementation(async () => ({
      id: "list-1",
      teamId: "team-1",
      isBlocklist: false,
    }))
    emailContactFindManyMock.mockImplementation(async () => [])

    const repo = new EmailCampaignRecipientRepository()
    await repo.findActiveRecipientsForList("list-1", { skip: 500, take: 500 })

    const pagedCall = emailContactFindManyMock.mock.calls.find((call) => {
      const args = (call as unknown as [{ skip?: number; take?: number }])[0]
      return args?.skip === 500 && args?.take === 500
    })
    expect(pagedCall).toBeDefined()
  })

  it("countActiveRecipientsForTeam usa COUNT DISTINCT no SQL físico das listas", async () => {
    queryRawMock.mockImplementation(async () => [{ count: BigInt(7) }])

    const repo = new EmailCampaignRecipientRepository()
    const count = await repo.countActiveRecipientsForTeam("team-1")

    expect(count).toBe(7)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const sql = sqlFromQueryRawCall(queryRawMock.mock.calls[0] as unknown[])
    expect(sql).toContain("COUNT(DISTINCT LOWER(TRIM(c.email)))")
    expect(sql).toContain('"corretor_studio_email_contacts"')
    expect(sql).toContain('"corretor_studio_email_contact_lists"')
    expect(emailContactCountMock).not.toHaveBeenCalled()
  })

  it("findActiveRecipientsForTeam pagina e-mails distintos, não linhas brutas", async () => {
    queryRawMock.mockImplementation(async () => [
      {
        id: "c-1",
        email: "a@test.com",
        name: "A",
        customFields: null,
      },
    ])

    const repo = new EmailCampaignRecipientRepository()
    const recipients = await repo.findActiveRecipientsForTeam("team-1", { skip: 500, take: 500 })

    expect(recipients).toEqual([
      { contactId: "c-1", email: "a@test.com", name: "A", customFields: null },
    ])
    expect(emailContactFindManyMock).not.toHaveBeenCalled()
    const sql = sqlFromQueryRawCall(queryRawMock.mock.calls[0] as unknown[])
    expect(sql).toContain("DISTINCT ON (LOWER(TRIM(c.email)))")
    expect(sql).toContain("OFFSET")
    expect(sql).toContain("LIMIT")
  })

  it("countSuppressedRecipientsForLists usa SQL split bounce/descadastro/reclamação", async () => {
    queryRawMock.mockImplementation(async () => [
      { bounced: BigInt(3), unsubscribed: BigInt(1), complained: BigInt(2) },
    ])

    const repo = new EmailCampaignRecipientRepository()
    const counts = await repo.countSuppressedRecipientsForLists("team-1", ["list-1"])

    expect(counts).toEqual({ bounced: 3, unsubscribed: 1, complained: 2, total: 6 })
    const sql = sqlFromQueryRawCall(queryRawMock.mock.calls[0] as unknown[])
    expect(sql).toContain("BOOL_OR(c.\"isBounced\")")
    expect(sql).toContain("BOOL_OR(c.\"isUnsubscribed\")")
    expect(sql).toContain("BOOL_OR(c.\"isComplained\")")
    expect(sql).toContain("flags.is_complained AND NOT flags.is_bounced")
    expect(sql).toContain("flags.is_unsubscribed AND NOT flags.is_bounced AND NOT flags.is_complained")
    expect(sql).not.toContain("flags.is_complained AND NOT flags.is_bounced AND NOT flags.is_unsubscribed")
    expect(sql).toContain('"corretor_studio_email_contacts"')
  })
})
