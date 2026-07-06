import { describe, expect, it } from "bun:test"
import { BackofficeAdhesionUseCase } from "./BackofficeAdhesionUseCase"
import type { IBackofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"
import type { IBackofficeSponsorAuthorizationService } from "@/app/api/services/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationService"

describe("BackofficeAdhesionUseCase.create", () => {
  it("rejeita adesão guest com patrocinador não autorizado antes de criar", async () => {
    let created = false
    const service = {
      create: async () => {
        created = true
        throw new Error("should not create")
      },
    } as unknown as IBackofficeAdhesionService

    const sponsorAuthorization: IBackofficeSponsorAuthorizationService = {
      assertAuthorizedSponsor: async () => ({
        isAuthorized: false,
        reason: "not_authorized",
        errorMessage: "Patrocinador não autorizado",
      }),
      listAuthorizedSponsors: async () => [],
      listAllWithCounts: async () => [],
      grant: async () => ({ error: "not implemented" }),
      revoke: async () => ({ error: "not implemented" }),
      countSponsoredAccounts: async () => 0,
      listEligibleMasters: async () => [],
    }

    const useCase = new BackofficeAdhesionUseCase(service, sponsorAuthorization)
    const output = await useCase.create(
      {
        leadId: "lead-1",
        userType: "guest",
        sponsorMasterId: "bad-sponsor",
        cycle: "monthly",
        billingType: "EXTERNAL",
        email: "guest@example.com",
        fullName: "Guest User",
        phone: "11999999999",
        cpfCnpj: "12345678901",
        extraUsers: 0,
        extraTeams: 0,
      },
      "bo-user-1"
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Patrocinador não autorizado")
    expect(created).toBe(false)
  })
})
