import { beforeEach, describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

// Manager ativo do backoffice numa conta de cliente é tratado como suporte: a
// conta dele não tem assinatura, e o bloqueio de cobrança do cliente não vale.

type BackofficeUser = { isActive: boolean; fullAccess: boolean } | null

let backofficeUser: BackofficeUser = { isActive: true, fullAccess: true }
let teamMasterId = "master-1"

const profileFindUnique = mock(async (_args: unknown) => ({
  id: "profile-1",
  managerId: null,
  activeTeamId: "team-1",
  backofficeUser,
}))
const teamFindFirst = mock(async (_args: unknown) => ({
  masterId: teamMasterId,
  master: { sponsorMasterId: null },
}))

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profile: { findUnique: profileFindUnique },
  team: { findFirst: teamFindFirst },
  teamMember: { findFirst: mock(async () => null) },
})

const { AccountAccessDecisionRepository } = await import("./AccountAccessDecisionRepository")

describe("AccountAccessDecisionRepository.resolveAccount e o suporte do backoffice", () => {
  beforeEach(() => {
    backofficeUser = { isActive: true, fullAccess: true }
    teamMasterId = "master-1"
    profileFindUnique.mockClear()
    teamFindFirst.mockClear()
  })

  it("Manager ativo num time de cliente recebe o registro de suporte", async () => {
    const record = await new AccountAccessDecisionRepository().resolveAccount({
      profileId: "profile-1",
      teamId: "team-1",
    })

    expect(record).toMatchObject({ billingOwnerId: "master-1", isSupportAccess: true, isBanned: false })
  })

  it("usa o time ativo quando nenhum time é informado", async () => {
    const record = await new AccountAccessDecisionRepository().resolveAccount({ profileId: "profile-1" })

    expect(record?.isSupportAccess).toBe(true)
    expect(teamFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "team-1", deletedAt: null } })
    )
  })

  it("Operator (sem acesso total) não é tratado como suporte", async () => {
    backofficeUser = { isActive: true, fullAccess: false }

    const record = await new AccountAccessDecisionRepository().resolveAccount({
      profileId: "profile-1",
      teamId: "team-1",
    })

    expect(record).toBeNull()
  })

  it("Manager inativo não é tratado como suporte", async () => {
    backofficeUser = { isActive: false, fullAccess: true }

    const record = await new AccountAccessDecisionRepository().resolveAccount({
      profileId: "profile-1",
      teamId: "team-1",
    })

    expect(record).toBeNull()
  })

  it("quem não é do backoffice segue o fluxo normal", async () => {
    backofficeUser = null

    const record = await new AccountAccessDecisionRepository().resolveAccount({
      profileId: "profile-1",
      teamId: "team-1",
    })

    expect(record).toBeNull()
  })
})
