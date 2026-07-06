import { describe, expect, it } from "bun:test"
import { BackofficeProfileUserTypeUseCase } from "./BackofficeProfileUserTypeUseCase"
import type { IBackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"
import type { IBackofficeSponsorAuthorizationService } from "@/app/api/services/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationService"
import { ProfileAsaasCustomerSyncUseCase } from "@/app/api/useCases/profileAsaasCustomer/ProfileAsaasCustomerSyncUseCase"

function createRepositoryMock(
  overrides: Partial<IBackofficeAllUsersRepository> = {}
): IBackofficeAllUsersRepository {
  return {
    findMany: async () => ({ items: [], totalItems: 0 }),
    findDetailById: async () => null,
    findSchedulesByProfileId: async () => ({ items: [], totalItems: 0 }),
    findEmailDispatchesByProfileId: async () => ({ items: [], totalItems: 0 }),
    findIsMaster: async () => true,
    upsertUserTypeAssignment: async () => ({
      slug: "guest",
      accessExpiresAt: null,
    }),
    updateSponsorMasterId: async () => undefined,
    setHasPermanentSubscription: async () => undefined,
    hasOpenProposalReviewsForAssociate: async () => false,
    ...overrides,
  } as IBackofficeAllUsersRepository
}

function createSponsorServiceMock(
  overrides: Partial<IBackofficeSponsorAuthorizationService> = {}
): IBackofficeSponsorAuthorizationService {
  return {
    assertAuthorizedSponsor: async () => ({ isAuthorized: true, errorMessage: null }),
    listAuthorizedSponsors: async () => [],
    listAllWithCounts: async () => [],
    grant: async () => ({ error: "not implemented" }),
    revoke: async () => ({ error: "not implemented" }),
    countSponsoredAccounts: async () => 0,
    listEligibleMasters: async () => [],
    ...overrides,
  }
}

describe("BackofficeProfileUserTypeUseCase.convert", () => {
  it("rejeita guest com patrocinador não autorizado sem escrever", async () => {
    let wrote = false
    const useCase = new BackofficeProfileUserTypeUseCase(
      createRepositoryMock({
        upsertUserTypeAssignment: async () => {
          wrote = true
          return { slug: "guest", label: "Convidado", accessExpiresAt: null, isExpired: false }
        },
      }),
      new ProfileAsaasCustomerSyncUseCase(),
      createSponsorServiceMock({
        assertAuthorizedSponsor: async () => ({
          isAuthorized: false,
          reason: "not_authorized",
          errorMessage: "Patrocinador não autorizado",
        }),
      })
    )

    const output = await useCase.convert("profile-1", "admin-1", {
      userType: "guest",
      sponsorMasterId: "sponsor-unauthorized",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Patrocinador não autorizado")
    expect(wrote).toBe(false)
  })

  it("mantém checagem não-self para guest", async () => {
    const useCase = new BackofficeProfileUserTypeUseCase(
      createRepositoryMock(),
      new ProfileAsaasCustomerSyncUseCase(),
      createSponsorServiceMock()
    )

    const output = await useCase.convert("profile-1", "admin-1", {
      userType: "guest",
      sponsorMasterId: "profile-1",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("A conta não pode ser patrocinada por ela mesma")
  })
})
