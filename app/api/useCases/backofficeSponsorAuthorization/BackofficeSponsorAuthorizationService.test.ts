import { describe, expect, it } from "bun:test"
import { BackofficeSponsorAuthorizationService } from "@/app/api/services/backofficeSponsorAuthorization/BackofficeSponsorAuthorizationService"
import type { IBackofficeSponsorAuthorizationRepository } from "@/app/api/infra/data/repositories/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationRepository"

function createRepositoryMock(
  overrides: Partial<IBackofficeSponsorAuthorizationRepository> = {}
): IBackofficeSponsorAuthorizationRepository {
  return {
    findProfileById: async () => null,
    findActiveAuthorization: async () => null,
    listActiveAuthorizedProfiles: async () => [],
    listAllWithAudit: async () => [],
    grant: async () => {
      throw new Error("not implemented")
    },
    revoke: async () => null,
    countSponsoredAccounts: async () => 0,
    listEligibleMasterProfiles: async () => [],
    ...overrides,
  }
}

describe("BackofficeSponsorAuthorizationService.assertAuthorizedSponsor", () => {
  it("autoriza master com registro ativo", async () => {
    const service = new BackofficeSponsorAuthorizationService(
      createRepositoryMock({
        findProfileById: async () => ({
          id: "sponsor-1",
          fullName: "Matheus",
          email: "matheus@example.com",
          isMaster: true,
        }),
        findActiveAuthorization: async () => ({ id: "auth-1", isActive: true }),
      })
    )

    const result = await service.assertAuthorizedSponsor("sponsor-1")
    expect(result.isAuthorized).toBe(true)
    expect(result.errorMessage).toBeNull()
  })

  it("rejeita profile inexistente", async () => {
    const service = new BackofficeSponsorAuthorizationService(createRepositoryMock())
    const result = await service.assertAuthorizedSponsor("missing")
    expect(result.isAuthorized).toBe(false)
    expect(result.reason).toBe("not_found")
  })

  it("rejeita profile que não é master", async () => {
    const service = new BackofficeSponsorAuthorizationService(
      createRepositoryMock({
        findProfileById: async () => ({
          id: "op-1",
          fullName: "Operador",
          email: "op@example.com",
          isMaster: false,
        }),
      })
    )

    const result = await service.assertAuthorizedSponsor("op-1")
    expect(result.isAuthorized).toBe(false)
    expect(result.reason).toBe("not_master")
    expect(result.errorMessage).toBe("Patrocinador não autorizado")
  })

  it("rejeita patrocinador revogado", async () => {
    const service = new BackofficeSponsorAuthorizationService(
      createRepositoryMock({
        findProfileById: async () => ({
          id: "sponsor-1",
          fullName: "Bruno",
          email: "bruno@example.com",
          isMaster: true,
        }),
        findActiveAuthorization: async () => ({ id: "auth-1", isActive: false }),
      })
    )

    const result = await service.assertAuthorizedSponsor("sponsor-1")
    expect(result.isAuthorized).toBe(false)
    expect(result.reason).toBe("not_authorized")
  })
})
