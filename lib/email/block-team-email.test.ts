import { beforeEach, describe, expect, it, mock } from "bun:test"

type ContactRow = { listId: string; email: string; name: string | null }

const state: {
  lists: Array<{ id: string; teamId: string; isArchived: boolean; isBlocklist: boolean; isSystemDefault: boolean }>
  contacts: ContactRow[]
  totals: Record<string, number>
  upserts: Array<{ listId: string; email: string }>
} = { lists: [], contacts: [], totals: {}, upserts: [] }

const tx = {
  emailContact: {
    findMany: mock(async (args: { where: { email: string; list: { teamId: string; isArchived: boolean; isBlocklist?: boolean } }; select: unknown }) =>
      state.contacts
        .filter((contact) => contact.email === args.where.email)
        .filter((contact) => {
          const list = state.lists.find((item) => item.id === contact.listId)
          if (!list || list.teamId !== args.where.list.teamId || list.isArchived) return false
          if (args.where.list.isBlocklist === false) return !list.isBlocklist
          return true
        })
        .map((contact) => ({ listId: contact.listId }))
    ),
    deleteMany: mock(async (args: { where: { email: string; list: { teamId: string; isArchived: boolean; isBlocklist?: boolean } } }) => {
      const before = state.contacts.length
      state.contacts = state.contacts.filter((contact) => {
        if (contact.email !== args.where.email) return true
        const list = state.lists.find((item) => item.id === contact.listId)
        if (!list || list.teamId !== args.where.list.teamId || list.isArchived) return true
        if (args.where.list.isBlocklist === false && list.isBlocklist) return true
        return false
      })
      return { count: before - state.contacts.length }
    }),
    count: mock(async (args: { where: { listId: string } }) =>
      state.contacts.filter((contact) => contact.listId === args.where.listId).length
    ),
    upsert: mock(async (args: {
      where: { listId_email: { listId: string; email: string } }
      create: { listId: string; email: string; name: string | null }
      update: { name?: string; isUnsubscribed?: boolean }
    }) => {
      const { listId, email } = args.where.listId_email
      state.upserts.push({ listId, email, ...args.update })
      if (!state.contacts.some((contact) => contact.listId === listId && contact.email === email)) {
        state.contacts.push({ listId, email, name: args.create.name })
      }
      return {}
    }),
  },
  emailContactList: {
    findFirst: mock(async (args: { where: { teamId: string; isBlocklist?: boolean } }) =>
      state.lists.find(
        (list) => list.teamId === args.where.teamId && !list.isArchived && list.isBlocklist
      ) ?? null
    ),
    create: mock(async (args: { data: { id: string; teamId: string } }) => {
      const list = {
        id: args.data.id,
        teamId: args.data.teamId,
        isArchived: false,
        isBlocklist: true,
        isSystemDefault: false,
      }
      state.lists.push(list)
      return { id: list.id }
    }),
    update: mock(async (args: { where: { id: string }; data: { totalContacts: number } }) => {
      state.totals[args.where.id] = args.data.totalContacts
      return {}
    }),
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({ prisma: tx, default: tx }))

const { blockTeamEmail } = await import("./email-contact-blocklist")

describe("blockTeamEmail", () => {
  beforeEach(() => {
    state.lists = [
      { id: "blocklist", teamId: "team-1", isArchived: false, isBlocklist: true, isSystemDefault: false },
      { id: "padrao", teamId: "team-1", isArchived: false, isBlocklist: false, isSystemDefault: true },
      { id: "fria", teamId: "team-1", isArchived: false, isBlocklist: false, isSystemDefault: false },
      { id: "outro-time", teamId: "team-2", isArchived: false, isBlocklist: false, isSystemDefault: false },
    ]
    state.contacts = [
      { listId: "padrao", email: "alvo@example.com", name: "Alvo" },
      { listId: "fria", email: "alvo@example.com", name: "Alvo" },
      { listId: "outro-time", email: "alvo@example.com", name: "Alvo" },
      { listId: "fria", email: "outro@example.com", name: "Outro" },
    ]
    state.totals = {}
    state.upserts = []
  })

  it("remove de todas as listas do time e insere na blocklist", async () => {
    await blockTeamEmail(tx as never, {
      teamId: "team-1",
      email: " Alvo@Example.COM ",
      name: "Alvo",
      createdBy: "profile-1",
    })

    const listasComAlvo = state.contacts
      .filter((contact) => contact.email === "alvo@example.com")
      .map((contact) => contact.listId)
      .sort()
    expect(listasComAlvo).toEqual(["blocklist", "outro-time"])

    expect(state.upserts).toHaveLength(1)
    expect(state.upserts[0].listId).toBe("blocklist")
  })

  it("recalcula totalContacts das listas afetadas e da blocklist", async () => {
    await blockTeamEmail(tx as never, {
      teamId: "team-1",
      email: "alvo@example.com",
      name: null,
      createdBy: "profile-1",
    })

    expect(state.totals["padrao"]).toBe(0)
    expect(state.totals["fria"]).toBe(1)
    expect(state.totals["blocklist"]).toBe(1)
    // Lista de outro time não é tocada.
    expect(state.totals["outro-time"]).toBeUndefined()
  })

  it("é idempotente: bloquear duas vezes não duplica a linha", async () => {
    const params = {
      teamId: "team-1",
      email: "alvo@example.com",
      name: null,
      createdBy: "profile-1",
    }
    await blockTeamEmail(tx as never, params)
    await blockTeamEmail(tx as never, params)

    const naBlocklist = state.contacts.filter(
      (contact) => contact.listId === "blocklist" && contact.email === "alvo@example.com"
    )
    expect(naBlocklist).toHaveLength(1)
    expect(state.totals["blocklist"]).toBe(1)
  })
})
