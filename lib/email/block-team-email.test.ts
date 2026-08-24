import { beforeEach, describe, expect, it, mock } from "bun:test"

type ContactRow = { listId: string; email: string; name: string | null }

const state: {
  lists: Array<{ id: string; teamId: string; isArchived: boolean; isBlocklist: boolean; isSystemDefault: boolean }>
  contacts: ContactRow[]
  totals: Record<string, number>
  upserts: Array<{ listId: string; email: string }>
} = { lists: [], contacts: [], totals: {}, upserts: [] }

type ContactWhere = {
  email: { in: string[] }
  list: { teamId: string; isArchived: boolean; isBlocklist?: boolean }
}

/** O código de produção filtra por `email: { in: [...] }`; o mock espelha isso. */
function matchesWhere(contact: ContactRow, where: ContactWhere): boolean {
  if (!where.email.in.includes(contact.email)) return false
  const list = state.lists.find((item) => item.id === contact.listId)
  if (!list || list.teamId !== where.list.teamId || list.isArchived) return false
  if (where.list.isBlocklist === false) return !list.isBlocklist
  return true
}

const tx = {
  emailContact: {
    findMany: mock(async (args: { where: ContactWhere; distinct?: string[] }) => {
      const rows = state.contacts
        .filter((contact) => matchesWhere(contact, args.where))
        .map((contact) => ({ listId: contact.listId }))
      if (!args.distinct?.includes("listId")) return rows
      return [...new Map(rows.map((row) => [row.listId, row])).values()]
    }),
    deleteMany: mock(async (args: { where: ContactWhere }) => {
      const before = state.contacts.length
      state.contacts = state.contacts.filter((contact) => !matchesWhere(contact, args.where))
      return { count: before - state.contacts.length }
    }),
    createMany: mock(async (args: {
      data: Array<{ listId: string; email: string; name: string | null }>
      skipDuplicates?: boolean
    }) => {
      let count = 0
      for (const row of args.data) {
        const exists = state.contacts.some(
          (contact) => contact.listId === row.listId && contact.email === row.email
        )
        if (exists && args.skipDuplicates) continue
        state.upserts.push({ listId: row.listId, email: row.email })
        state.contacts.push({ listId: row.listId, email: row.email, name: row.name })
        count += 1
      }
      return { count }
    }),
    updateMany: mock(async () => ({ count: 0 })),
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

const { blockTeamEmail, blockTeamEmailsBulk } = await import("./email-contact-blocklist")

function resetState() {
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
}

describe("blockTeamEmailsBulk", () => {
  beforeEach(resetState)

  it("bloqueia o lote inteiro sem custo proporcional ao número de endereços", async () => {
    tx.emailContact.deleteMany.mockClear()
    tx.emailContact.createMany.mockClear()

    const { blockedCount } = await blockTeamEmailsBulk(tx as never, {
      teamId: "team-1",
      createdBy: "profile-1",
      contacts: Array.from({ length: 40 }, (_, i) => ({
        email: `bulk${i}@example.com`,
        name: `Bulk ${i}`,
      })),
    })

    expect(blockedCount).toBe(40)
    // Um deleteMany e um createMany para as 40 linhas — não 40 de cada.
    expect(tx.emailContact.deleteMany.mock.calls.length).toBeLessThanOrEqual(1)
    expect(tx.emailContact.createMany.mock.calls.length).toBe(1)
  })

  it("deduplica por e-mail normalizado dentro do lote", async () => {
    const { blockedCount } = await blockTeamEmailsBulk(tx as never, {
      teamId: "team-1",
      createdBy: "profile-1",
      contacts: [
        { email: "Repetido@Example.com", name: "A" },
        { email: " repetido@example.com ", name: "B" },
        { email: "unico@example.com", name: "C" },
      ],
    })

    expect(blockedCount).toBe(2)
    const naBlocklist = state.contacts
      .filter((contact) => contact.listId === "blocklist")
      .map((contact) => contact.email)
      .sort()
    expect(naBlocklist).toEqual(["repetido@example.com", "unico@example.com"])
  })

  it("tira do time todas as listas, preservando lista de outro time", async () => {
    await blockTeamEmailsBulk(tx as never, {
      teamId: "team-1",
      createdBy: "profile-1",
      contacts: [{ email: "alvo@example.com", name: null }],
    })

    const listasComAlvo = state.contacts
      .filter((contact) => contact.email === "alvo@example.com")
      .map((contact) => contact.listId)
      .sort()
    expect(listasComAlvo).toEqual(["blocklist", "outro-time"])
    expect(state.totals["padrao"]).toBe(0)
    expect(state.totals["blocklist"]).toBe(1)
  })

  it("não conta quem já estava bloqueado — blockedCount é o que de fato foi inserido", async () => {
    state.contacts.push({ listId: "blocklist", email: "javablocked@example.com", name: "Ja" })

    const { blockedCount } = await blockTeamEmailsBulk(tx as never, {
      teamId: "team-1",
      createdBy: "profile-1",
      contacts: [
        { email: "javablocked@example.com", name: "Ja" },
        { email: "novo@example.com", name: "Novo" },
      ],
    })

    // 2 endereços únicos no input, mas só 1 vira linha nova: `skipDuplicates`
    // pula o preexistente. Devolver `byEmail.size` reportaria 2 e inflaria o
    // importedCount a cada reprocessamento do mesmo lote.
    expect(blockedCount).toBe(1)
  })

  it("lote inteiro já bloqueado → blockedCount 0", async () => {
    state.contacts.push({ listId: "blocklist", email: "a@example.com", name: null })
    state.contacts.push({ listId: "blocklist", email: "b@example.com", name: null })

    const { blockedCount } = await blockTeamEmailsBulk(tx as never, {
      teamId: "team-1",
      createdBy: "profile-1",
      contacts: [{ email: "a@example.com", name: null }, { email: "b@example.com", name: null }],
    })

    expect(blockedCount).toBe(0)
  })

  it("ignora linhas sem e-mail sem quebrar o lote", async () => {
    const { blockedCount } = await blockTeamEmailsBulk(tx as never, {
      teamId: "team-1",
      createdBy: "profile-1",
      contacts: [{ email: "   ", name: null }, { email: "valido@example.com", name: null }],
    })
    expect(blockedCount).toBe(1)
  })
})

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
