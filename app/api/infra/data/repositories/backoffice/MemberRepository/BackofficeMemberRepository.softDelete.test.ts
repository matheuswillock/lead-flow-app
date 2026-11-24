import { beforeEach, describe, expect, it, mock } from "bun:test"

const tx = {
  profile: {
    findFirst: mock(async () => ({
      id: "closer-1",
      isMaster: false,
      managerId: "master-1",
      email: "closer@example.com",
      fullName: "Closer Exemplo",
    })),
    update: mock(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({})),
  },
  lead: { updateMany: mock(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 0 })) },
  teamMember: { deleteMany: mock(async () => ({ count: 1 })) },
  backofficeDeletionAuditLog: { create: mock(async () => ({})) },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $transaction: async (callback: (client: typeof tx) => Promise<void>) => callback(tx) },
}))

const { BackofficeMemberRepository } = await import("./BackofficeMemberRepository")
const { removedProfileEmailFor } = await import("@/lib/account/removed-profile-email")

beforeEach(() => {
  tx.lead.updateMany.mockClear()
})

describe("BackofficeMemberRepository.softDeleteMemberCascade — libera o e-mail do removido", () => {
  it("troca o e-mail do perfil removido por um tombstone, senão o e-mail fica preso para nova adesão", async () => {
    tx.profile.update.mockClear()

    await new BackofficeMemberRepository().softDeleteMemberCascade("closer-1", "admin-1")

    const profileCall = tx.profile.update.mock.calls
      .map(([args]) => args)
      .find((args) => args.where.id === "closer-1")

    expect(profileCall?.data).toMatchObject({ email: removedProfileEmailFor("closer-1") })
    expect(profileCall?.data.deletedAt).toBeInstanceOf(Date)
  })
})

describe("BackofficeMemberRepository.softDeleteMemberCascade — closer que sai da corretora", () => {
  it("não zera o closer dos leads que estão na carteira: o nome atribuído continua", async () => {
    await new BackofficeMemberRepository().softDeleteMemberCascade("closer-1", "admin-1")

    const closerCall = tx.lead.updateMany.mock.calls
      .map(([args]) => args)
      .find((args) => args.where.closerId === "closer-1")

    expect(closerCall?.data).toEqual({ closerId: null })
    // Só leads fora da carteira perdem o closer; os da carteira mantêm a atribuição histórica.
    expect(closerCall?.where).toMatchObject({ portfolio: { is: null } })
  })

  it("continua liberando os leads do SDR que saiu (assignedTo)", async () => {
    await new BackofficeMemberRepository().softDeleteMemberCascade("closer-1", "admin-1")

    const sdrCall = tx.lead.updateMany.mock.calls
      .map(([args]) => args)
      .find((args) => args.where.assignedTo === "closer-1")

    expect(sdrCall?.data).toEqual({ assignedTo: null })
  })
})
