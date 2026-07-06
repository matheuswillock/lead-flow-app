import { describe, expect, it, mock } from "bun:test"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"

const findProfileBySupabaseIdMock = mock(async () => ({
  id: "profile-1",
  email: "user@test.com",
}))

const createOptionMock = mock(async () => ({
  created: true,
  duplicate: false,
  option: { id: "hp-1", name: "Plano A", iconUrl: null, isDefault: false },
}))

mock.module("@/app/api/services/healthPlans/HealthPlanService", () => ({
  healthPlanService: {
    findProfileBySupabaseId: findProfileBySupabaseIdMock,
    createOption: createOptionMock,
  },
}))

const { HealthPlanUseCase } = await import("@/app/api/useCases/healthPlans/HealthPlanUseCase")

describe("HealthPlanUseCase.createHealthPlan", () => {
  it("retorna 403 para usuário sem fullAccess no backoffice", async () => {
    const repo: IBackofficeUserRepository = {
      findByProfileId: async () => ({
        id: "bo-1",
        profileId: "profile-1",
        email: "op@test.com",
        isActive: true,
        fullAccess: false,
        isSdr: false,
        isCloser: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as IBackofficeUserRepository

    const useCase = new HealthPlanUseCase(repo)
    const output = await useCase.createHealthPlan("supabase-1", "Plano Teste")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Acesso negado")
  })

  it("cria plano para backoffice master ativo", async () => {
    const repo: IBackofficeUserRepository = {
      findByProfileId: async () => ({
        id: "bo-1",
        profileId: "profile-1",
        email: "master@test.com",
        isActive: true,
        fullAccess: true,
        isSdr: false,
        isCloser: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as IBackofficeUserRepository

    const useCase = new HealthPlanUseCase(repo)
    const output = await useCase.createHealthPlan("supabase-1", "Plano Teste")
    expect(output.isValid).toBe(true)
    expect(createOptionMock).toHaveBeenCalled()
  })
})
