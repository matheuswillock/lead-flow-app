import { describe, expect, it } from "bun:test"
import type { BackofficeFeature } from "@prisma/client"
import { BackofficeFeatureUseCase } from "./BackofficeFeatureUseCase"
import type {
  BackofficeFeatureWithRelations,
  IBackofficeFeatureRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/IBackofficeFeatureRepository"

function makeFeature(
  overrides: Partial<BackofficeFeature> & Record<string, unknown> = {}
): BackofficeFeature {
  return {
    id: "feature-1",
    slug: "email-campaigns",
    name: "Campanhas",
    description: null,
    parentId: null,
    productSlug: "email",
    accessMode: "ADDON",
    defaultAccessLevel: "FULL",
    betaEnabled: true,
    inheritParentSettings: false,
    billedSeparately: false,
    chargeDuringBeta: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as BackofficeFeature
}

function createRepositoryMock(
  overrides: Partial<IBackofficeFeatureRepository> = {}
): IBackofficeFeatureRepository {
  const existing = makeFeature()
  return {
    findAll: async () =>
      [
        {
          ...existing,
          parent: null,
          children: [],
          grants: [],
          accessRules: [],
        },
      ] as BackofficeFeatureWithRelations[],
    findActive: async () => [existing],
    findById: async () => existing,
    findBySlug: async () => null,
    productSlugExists: async () => true,
    profileExists: async () => true,
    findProfileById: async () => null,
    validateTeamsBelongToMaster: async () => true,
    create: async (data) => makeFeature(data as Partial<BackofficeFeature>),
    update: async (_id, data) => makeFeature({ ...existing, ...data }),
    delete: async () => undefined,
    listAvailableSlugs: async () => ["email-campaigns"],
    searchUsers: async () => ({ items: [], totalItems: 0 }),
    upsertBetaGrant: async () => {
      throw new Error("not used")
    },
    upsertAccessRule: async () => {
      throw new Error("not used")
    },
    deleteAccessRule: async () => undefined,
    replaceAccessRules: async () => undefined,
    disableBetaGrant: async () => undefined,
    listBetaGrants: async () => [],
    listActiveBetaGrantsForProfile: async () => [],
    ...overrides,
  }
}

describe("BackofficeFeatureUseCase chargeDuringBeta", () => {
  it("T04: chargeDuringBeta=true sem productSlug retorna erro de validação", async () => {
    const useCase = new BackofficeFeatureUseCase(
      createRepositoryMock({
        findById: async () => makeFeature({ productSlug: null, betaEnabled: true, accessMode: "ADDON" }),
      })
    )

    const output = await useCase.update("feature-1", {
      chargeDuringBeta: true,
      productSlug: null,
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/produto|productSlug|cobrança|cobranca/i)
  })

  it("T04b: chargeDuringBeta=true sem betaEnabled retorna erro de validação", async () => {
    const useCase = new BackofficeFeatureUseCase(
      createRepositoryMock({
        findById: async () =>
          makeFeature({ betaEnabled: false, productSlug: "email", accessMode: "ADDON" }),
      })
    )

    const output = await useCase.update("feature-1", {
      chargeDuringBeta: true,
      betaEnabled: false,
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/beta/i)
  })

  it("T04c: chargeDuringBeta=true com accessMode PUBLIC retorna erro de validação", async () => {
    const useCase = new BackofficeFeatureUseCase(
      createRepositoryMock({
        findById: async () =>
          makeFeature({ betaEnabled: true, productSlug: "email", accessMode: "PUBLIC" }),
      })
    )

    const output = await useCase.update("feature-1", {
      chargeDuringBeta: true,
      accessMode: "PUBLIC",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/PAID|ADDON|pago|adicional|accessMode/i)
  })

  it("persiste chargeDuringBeta=true quando beta + ADDON + productSlug estão válidos", async () => {
    let updatedChargeDuringBeta: boolean | undefined
    const useCase = new BackofficeFeatureUseCase(
      createRepositoryMock({
        findById: async () =>
          makeFeature({ betaEnabled: true, productSlug: "email", accessMode: "ADDON" }),
        update: async (_id, data) => {
          updatedChargeDuringBeta = data.chargeDuringBeta
          return makeFeature({ ...data })
        },
      })
    )

    const output = await useCase.update("feature-1", {
      chargeDuringBeta: true,
    })

    expect(output.isValid).toBe(true)
    expect(updatedChargeDuringBeta).toBe(true)
  })
})
