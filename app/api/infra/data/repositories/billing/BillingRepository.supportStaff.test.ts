import { beforeEach, describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"
import { EXCLUDE_CORRETOR_STUDIO_STAFF_PROFILE_FILTER } from "@/lib/backoffice/email-domain"

// A equipe Corretor Studio (@corretorstudio.com.br) nunca entra na contagem de
// usuários cobrados da conta do cliente.

const teamMemberFindManyMock = mock(async (_args: unknown) => [{ profileId: "cliente-1" }])

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profile: {
    findUnique: mock(async () => ({
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
      userTypeAssignment: null,
    })),
  },
  team: { count: mock(async () => 1) },
  teamMember: { findMany: teamMemberFindManyMock },
  backofficeAdhesion: { findMany: mock(async () => []) },
  backofficeUserSubscription: { findMany: mock(async () => []) },
  profileSubscription: { findUnique: mock(async () => null) },
})

const { billingRepository } = await import("./BillingRepository")

describe("BillingRepository.getBillingSnapshot e a equipe Corretor Studio", () => {
  beforeEach(() => {
    teamMemberFindManyMock.mockClear()
  })

  it("exclui perfis @corretorstudio.com.br da contagem de usuários", async () => {
    await billingRepository.getBillingSnapshot("master-1")

    const args = teamMemberFindManyMock.mock.calls[0]?.[0] as {
      where: { team: { masterId: string }; profile: unknown }
    }
    expect(args.where.team).toEqual({ masterId: "master-1" })
    expect(args.where.profile).toEqual(EXCLUDE_CORRETOR_STUDIO_STAFF_PROFILE_FILTER)
  })
})
