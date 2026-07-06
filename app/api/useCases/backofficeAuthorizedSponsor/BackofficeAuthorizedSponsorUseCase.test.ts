import { describe, expect, it } from "bun:test"
import { BackofficeAuthorizedSponsorUseCase } from "./BackofficeAuthorizedSponsorUseCase"
import type { IBackofficeSponsorAuthorizationService } from "@/app/api/services/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationService"

function createServiceMock(
  overrides: Partial<IBackofficeSponsorAuthorizationService> = {}
): IBackofficeSponsorAuthorizationService {
  return {
    assertAuthorizedSponsor: async () => ({ isAuthorized: true, errorMessage: null }),
    listAuthorizedSponsors: async () => [],
    listAllWithCounts: async () => [],
    listEligibleMasters: async () => [],
    grant: async () => ({ error: "not implemented" }),
    revoke: async () => ({ error: "not implemented" }),
    countSponsoredAccounts: async () => 0,
    ...overrides,
  }
}

describe("BackofficeAuthorizedSponsorUseCase", () => {
  it("lista patrocinadores e masters elegíveis", async () => {
    const useCase = new BackofficeAuthorizedSponsorUseCase(
      createServiceMock({
        listAllWithCounts: async () => [
          {
            id: "p1",
            fullName: "Matheus",
            email: "matheus@example.com",
            isActive: true,
            grantedAt: new Date(),
            grantedBy: null,
            revokedAt: null,
            revokedBy: null,
            notes: null,
            sponsoredAccountsCount: 2,
          },
        ],
        listEligibleMasters: async () => [],
      })
    )

    const output = await useCase.list("admin-profile")
    expect(output.isValid).toBe(true)
    expect((output.result as { items: unknown[] }).items).toHaveLength(1)
  })

  it("retorna erro quando grant falha", async () => {
    const useCase = new BackofficeAuthorizedSponsorUseCase(
      createServiceMock({
        grant: async () => ({ error: "Somente masters podem ser autorizados como patrocinadores" }),
      })
    )

    const output = await useCase.grant("p1", "admin-profile")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Somente masters")
  })
})
